import { describe, it, expect } from 'vitest';
import { POST as postCorrection } from '../../app/api/v1/stock/corrections/route';
import { POST as postWriteOff } from '../../app/api/v1/stock/write-offs/route';
import { POST as returnToAvailable } from '../../app/api/v1/stock/return-to-available/route';
import { POST as approve } from '../../app/api/v1/stock/requests/[id]/approve/route';
import { POST as reject } from '../../app/api/v1/stock/requests/[id]/reject/route';
import { GET as listRequests } from '../../app/api/v1/stock/requests/route';
import { webSessionFor } from '../session-helpers';
import { basicStock } from '../inventory-helpers';
import { balanceOf } from '../../server/stock/balances';
import { makeReq } from '../request';
import { getPool, withTransaction } from '../../db/client';
import { postMovements } from '../../server/stock/post';

async function storeManagerFor(warehouseId: string) {
  const sm = await webSessionFor(['store_manager']);
  await getPool().query('INSERT INTO warehouse_assignments (user_id, warehouse_id) VALUES ($1, $2)', [sm.user.id, warehouseId]);
  return sm;
}

describe('manual corrections (003 clarification, FR-012a)', () => {
  it('a Store Manager request changes nothing until an Admin approves it', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    const sm = await storeManagerFor(wh.id);
    const res = await postCorrection(makeReq('POST', '/api/v1/stock/corrections', { ...sm.as, body: { itemId: chair.id, locationId: wh.defaultLocationId, condition: 'available', quantityChange: '-3', reason: 'found broken in storage' } }));
    expect(res.status).toBe(202);
    const req = await res.json();
    expect(req.status).toBe('pending');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('40.000');
    const ok = await approve(makeReq('POST', `/api/v1/stock/requests/${req.id}/approve`, { ...admin.as, body: {} }), { params: { id: req.id } });
    expect(ok.status).toBe(200);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('37.000');
    const { rows } = await getPool().query("SELECT actor_user_id, reason, reference_type FROM stock_movements WHERE type = 'adjustment'");
    expect(rows[0]).toMatchObject({ actor_user_id: admin.user.id, reason: 'found broken in storage', reference_type: 'correction_request' });
  });

  it("an Admin's own correction applies at once", async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    const res = await postCorrection(makeReq('POST', '/api/v1/stock/corrections', { ...admin.as, body: { itemId: chair.id, locationId: wh.defaultLocationId, condition: 'available', quantityChange: '2', reason: 'found in van' } }));
    expect(res.status).toBe(201);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('42.000');
  });

  it('a rejected request posts nothing', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    const sm = await storeManagerFor(wh.id);
    const req = await (await postCorrection(makeReq('POST', '/api/v1/stock/corrections', { ...sm.as, body: { itemId: chair.id, locationId: wh.defaultLocationId, condition: 'available', quantityChange: '-3', reason: 'x' } }))).json();
    expect((await reject(makeReq('POST', `/api/v1/stock/requests/${req.id}/reject`, { ...admin.as, body: { note: 'recount' } }), { params: { id: req.id } })).status).toBe(200);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('40.000');
    const again = await approve(makeReq('POST', `/api/v1/stock/requests/${req.id}/approve`, { ...admin.as, body: {} }), { params: { id: req.id } });
    expect(again.status).toBe(409);
  });

  it('Store Managers may only request for assigned warehouses; Event Managers not at all', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    const otherSm = await webSessionFor(['store_manager']);
    const em = await webSessionFor(['event_manager']);
    const body = { itemId: chair.id, locationId: wh.defaultLocationId, condition: 'available', quantityChange: '-1', reason: 'x' };
    expect((await postCorrection(makeReq('POST', '/api/v1/stock/corrections', { ...otherSm.as, body }))).status).toBe(403);
    expect((await postCorrection(makeReq('POST', '/api/v1/stock/corrections', { ...em.as, body }))).status).toBe(403);
    expect((await listRequests(makeReq('GET', '/api/v1/stock/requests?status=pending', otherSm.as))).status).toBe(403);
  });

  it('notifies Admins of a pending request (outbox)', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    const sm = await storeManagerFor(wh.id);
    await postCorrection(makeReq('POST', '/api/v1/stock/corrections', { ...sm.as, body: { itemId: chair.id, locationId: wh.defaultLocationId, condition: 'available', quantityChange: '-1', reason: 'x' } }));
    const { rows } = await getPool().query("SELECT trigger FROM notification_outbox WHERE trigger = 'stock.request_pending'");
    expect(rows).toHaveLength(1);
  });
});

describe('write-offs and return to available (003 US6)', () => {
  async function withDamaged() {
    const admin = await webSessionFor(['admin']);
    const s = await basicStock(admin.as);
    await withTransaction((tx) => postMovements(tx, [{ type: 'damage', itemId: s.chair.id, quantity: '5', from: { locationId: s.wh.defaultLocationId, condition: 'available' }, to: { locationId: s.wh.defaultLocationId, condition: 'damaged' }, reason: 'x' }], { actorUserId: admin.user.id }));
    return { admin, ...s };
  }

  it('write-off is always a request; approval moves damaged → written off', async () => {
    const { admin, chair, wh } = await withDamaged();
    const req = await (await postWriteOff(makeReq('POST', '/api/v1/stock/write-offs', { ...admin.as, body: { itemId: chair.id, locationId: wh.defaultLocationId, quantity: '3', reason: 'beyond repair' } }))).json();
    expect(req.status).toBe('pending');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'damaged')).toBe('5.000');
    await approve(makeReq('POST', `/api/v1/stock/requests/${req.id}/approve`, { ...admin.as, body: {} }), { params: { id: req.id } });
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'damaged')).toBe('2.000');
    expect(await balanceOf(chair.id, null, 'written_off')).toBe('3.000');
  });

  it('usable damaged stock returns to Available with a reason', async () => {
    const { admin, chair, wh } = await withDamaged();
    const res = await returnToAvailable(makeReq('POST', '/api/v1/stock/return-to-available', { ...admin.as, body: { itemId: chair.id, locationId: wh.defaultLocationId, quantity: '2', reason: 'glued and fine' } }));
    expect(res.status).toBe(201);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('37.000');
  });
});
