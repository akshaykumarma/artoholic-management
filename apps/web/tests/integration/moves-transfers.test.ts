import { describe, it, expect } from 'vitest';
import { POST as createWh } from '../../app/api/v1/warehouses/route';
import { PATCH as patchWh } from '../../app/api/v1/warehouses/[id]/route';
import { POST as bulk } from '../../app/api/v1/warehouses/[id]/locations/bulk/route';
import { GET as listLocations } from '../../app/api/v1/warehouses/[id]/locations/route';
import { GET as binSuggestions } from '../../app/api/v1/warehouses/[id]/bin-suggestions/route';
import { PATCH as patchLocation } from '../../app/api/v1/locations/[id]/route';
import { POST as move } from '../../app/api/v1/stock/moves/route';
import { POST as createTransfer } from '../../app/api/v1/transfers/route';
import { POST as dispatch } from '../../app/api/v1/transfers/[id]/dispatch/route';
import { POST as receive } from '../../app/api/v1/transfers/[id]/receive/route';
import { POST as cancel } from '../../app/api/v1/transfers/[id]/cancel/route';
import { POST as shortfall } from '../../app/api/v1/transfers/[id]/lines/[lineId]/shortfall/route';
import { webSessionFor } from '../session-helpers';
import { category, item, opening } from '../inventory-helpers';
import { balanceOf } from '../../server/stock/balances';
import { makeReq } from '../request';

type As = { cookies: Record<string, string>; csrf: string };

async function warehouseWithBins(as: As, code: string) {
  const w = await (await createWh(makeReq('POST', '/api/v1/warehouses', { ...as, body: { code, name: code } }))).json();
  await patchWh(makeReq('PATCH', '/x', { ...as, body: { levels: ['Aisle', 'Row'] } }), { params: { id: w.id } });
  await bulk(makeReq('POST', '/x', { ...as, body: { ranges: [{ from: 'A', to: 'B' }, { from: 1, to: 2 }] } }), { params: { id: w.id } });
  const locs = (await (await listLocations(makeReq('GET', `/x?q=${code}-`, as), { params: { id: w.id } })).json()).items as Array<{ id: string; code: string; isBin: boolean; isDefault: boolean }>;
  const bin = (c: string) => locs.find((l) => l.code === c)!.id;
  return { id: w.id as string, defaultLocationId: w.defaultLocationId as string, bin };
}

async function setup() {
  const admin = await webSessionFor(['admin']);
  const cat = await category(admin.as);
  const chair = await item(admin.as, { name: 'Chair', categoryId: cat, trackingType: 'counted' });
  const main = await warehouseWithBins(admin.as, 'MAIN');
  expect((await opening(admin.as, [{ itemId: chair.id, locationId: main.bin('MAIN-A-01'), quantity: '25' }])).status).toBe(201);
  return { admin, chair, main };
}

describe('moves within a warehouse (004 US3)', () => {
  it('moves 10 of 25 chairs in one ledger entry', async () => {
    const { admin, chair, main } = await setup();
    const res = await move(makeReq('POST', '/api/v1/stock/moves', { ...admin.as, body: { itemId: chair.id, fromLocationId: main.bin('MAIN-A-01'), toLocationId: main.bin('MAIN-B-02'), quantity: '10', condition: 'available' } }));
    expect(res.status).toBe(201);
    expect(await balanceOf(chair.id, main.bin('MAIN-A-01'), 'available')).toBe('15.000');
    expect(await balanceOf(chair.id, main.bin('MAIN-B-02'), 'available')).toBe('10.000');
    const over = await move(makeReq('POST', '/api/v1/stock/moves', { ...admin.as, body: { itemId: chair.id, fromLocationId: main.bin('MAIN-A-01'), toLocationId: main.bin('MAIN-B-02'), quantity: '16', condition: 'available' } }));
    expect(over.status).toBe(409);
  });

  it('only bins hold stock once a warehouse has bins; aisles never do', async () => {
    const { admin, chair, main } = await setup();
    const toDefault = await opening(admin.as, [{ itemId: chair.id, locationId: main.defaultLocationId, quantity: '1' }]);
    expect((await toDefault.json()).error.code).toBe('NOT_A_BIN');
  });

  it('suggests the bins that already hold the item first', async () => {
    const { admin, chair, main } = await setup();
    const res = await (await binSuggestions(makeReq('GET', `/x?itemId=${chair.id}`, admin.as), { params: { id: main.id } })).json();
    expect(res.items[0].code).toBe('MAIN-A-01');
  });

  it('a bin holding stock cannot be deactivated; an empty one can', async () => {
    const { admin, main } = await setup();
    const full = await patchLocation(makeReq('PATCH', '/x', { ...admin.as, body: { status: 'archived' } }), { params: { id: main.bin('MAIN-A-01') } });
    expect((await full.json()).error.code).toBe('LOCATION_NOT_EMPTY');
    const empty = await patchLocation(makeReq('PATCH', '/x', { ...admin.as, body: { status: 'archived' } }), { params: { id: main.bin('MAIN-B-01') } });
    expect(empty.status).toBe(200);
  });
});

describe('transfers between warehouses (004 US4)', () => {
  it('dispatch puts stock in transit (counted nowhere); receipt with a shortfall waits for an Admin', async () => {
    const { admin, chair, main } = await setup();
    const north = await warehouseWithBins(admin.as, 'NORTH');
    const t = await (await createTransfer(makeReq('POST', '/api/v1/transfers', { ...admin.as, body: { fromWarehouseId: main.id, toWarehouseId: north.id, lines: [{ itemId: chair.id, quantity: '20' }] } }))).json();
    expect(t.number).toMatch(/^TRF-\d{4}-0001$/);
    const line = t.lines[0].id;
    const d = await dispatch(makeReq('POST', '/x', { ...admin.as, body: { lines: [{ lineId: line, dispatchedQty: '20', fromLocationId: main.bin('MAIN-A-01') }] } }), { params: { id: t.id } });
    expect(d.status).toBe(200);
    expect(await balanceOf(chair.id, main.bin('MAIN-A-01'), 'available')).toBe('5.000');
    expect(await balanceOf(chair.id, null, 'in_transit')).toBe('20.000');
    const r = await receive(makeReq('POST', '/x', { ...admin.as, body: { lines: [{ lineId: line, receivedQty: '19', toLocationId: north.bin('NORTH-A-01') }], confirmMissing: true } }), { params: { id: t.id } });
    expect(r.status).toBe(200);
    expect((await r.json()).lines[0]).toMatchObject({ missingQty: '1.000', shortfallDecision: 'pending' });
    expect(await balanceOf(chair.id, north.bin('NORTH-A-01'), 'available')).toBe('19.000');
    const s = await shortfall(makeReq('POST', '/x', { ...admin.as, body: { decision: 'lost', note: 'not found' } }), { params: { id: t.id, lineId: line } });
    expect(s.status).toBe(200);
    expect(await balanceOf(chair.id, null, 'in_transit')).toBe('0.000');
    expect(await balanceOf(chair.id, null, 'lost')).toBe('1.000');
  });

  it('receiving less than dispatched needs the missing quantity confirmed', async () => {
    const { admin, chair, main } = await setup();
    const north = await warehouseWithBins(admin.as, 'NORTH');
    const t = await (await createTransfer(makeReq('POST', '/x', { ...admin.as, body: { fromWarehouseId: main.id, toWarehouseId: north.id, lines: [{ itemId: chair.id, quantity: '5' }] } }))).json();
    await dispatch(makeReq('POST', '/x', { ...admin.as, body: { lines: [{ lineId: t.lines[0].id, dispatchedQty: '5', fromLocationId: main.bin('MAIN-A-01') }] } }), { params: { id: t.id } });
    const r = await receive(makeReq('POST', '/x', { ...admin.as, body: { lines: [{ lineId: t.lines[0].id, receivedQty: '4', toLocationId: north.bin('NORTH-A-01') }] } }), { params: { id: t.id } });
    expect(r.status).toBe(400);
  });

  it('a returned shortfall goes back to the source bin; cancel only before dispatch', async () => {
    const { admin, chair, main } = await setup();
    const north = await warehouseWithBins(admin.as, 'NORTH');
    const t = await (await createTransfer(makeReq('POST', '/x', { ...admin.as, body: { fromWarehouseId: main.id, toWarehouseId: north.id, lines: [{ itemId: chair.id, quantity: '5' }] } }))).json();
    await dispatch(makeReq('POST', '/x', { ...admin.as, body: { lines: [{ lineId: t.lines[0].id, dispatchedQty: '5', fromLocationId: main.bin('MAIN-A-01') }] } }), { params: { id: t.id } });
    expect((await cancel(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: t.id } })).status).toBe(409);
    await receive(makeReq('POST', '/x', { ...admin.as, body: { lines: [{ lineId: t.lines[0].id, receivedQty: '3', toLocationId: north.bin('NORTH-A-01') }], confirmMissing: true } }), { params: { id: t.id } });
    await shortfall(makeReq('POST', '/x', { ...admin.as, body: { decision: 'returned' } }), { params: { id: t.id, lineId: t.lines[0].id } });
    expect(await balanceOf(chair.id, main.bin('MAIN-A-01'), 'available')).toBe('22.000');
  });

  it('Store Managers dispatch only from their warehouse', async () => {
    const { admin, chair, main } = await setup();
    const north = await warehouseWithBins(admin.as, 'NORTH');
    const sm = await webSessionFor(['store_manager']);
    await patchWh(makeReq('PATCH', '/x', { ...admin.as, body: { storeManagerIds: [sm.user.id] } }), { params: { id: north.id } });
    const t = await (await createTransfer(makeReq('POST', '/x', { ...admin.as, body: { fromWarehouseId: main.id, toWarehouseId: north.id, lines: [{ itemId: chair.id, quantity: '5' }] } }))).json();
    const d = await dispatch(makeReq('POST', '/x', { ...sm.as, body: { lines: [{ lineId: t.lines[0].id, dispatchedQty: '5', fromLocationId: main.bin('MAIN-A-01') }] } }), { params: { id: t.id } });
    expect(d.status).toBe(403);
  });
});
