import { describe, it, expect } from 'vitest';
import { itemViewSchema, itemListSchema } from '@artoholic/shared';
import { GET as getItem } from '../../app/api/v1/catalogue/items/[id]/route';
import { GET as listItems } from '../../app/api/v1/catalogue/items/route';
import { webSessionFor } from '../session-helpers';
import { basicStock, category, item } from '../inventory-helpers';
import { makeReq } from '../request';
import { withTransaction, getPool } from '../../db/client';
import { postMovements } from '../../server/stock/post';

describe('item view (003 US5, FR-007/008)', () => {
  it('shows on hand by condition and location, damage summary and history', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    await withTransaction((tx) => postMovements(tx, [
      { type: 'damage', itemId: chair.id, quantity: '5', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { locationId: wh.defaultLocationId, condition: 'damaged' }, reason: 'x' },
      { type: 'lost', itemId: chair.id, quantity: '1', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { condition: 'lost' }, reason: 'missing' }
    ], { actorUserId: admin.user.id }));
    const v = itemViewSchema.parse(await (await getItem(makeReq('GET', `/api/v1/catalogue/items/${chair.id}`, admin.as), { params: { id: chair.id } })).json());
    expect(v.totals).toMatchObject({ available: '34.000', damaged: '5.000', lost: '1.000' });
    expect(v.onHand).toBe('39.000'); // lost is not on hand
    expect(v.balances.find((b) => b.condition === 'available')!.locationCode).toBe('MAIN-DEFAULT');
    expect(v.damage).toMatchObject({ damagedToDate: '5.000', currentlyDamaged: '5.000', lost: '1.000' });
    expect(v.history.map((h) => h.type)).toEqual(['lost', 'damage', 'opening']);
  });

  it('Store Managers see only their warehouses in balances', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair } = await basicStock(admin.as);
    const sm = await webSessionFor(['store_manager']);
    const v = itemViewSchema.parse(await (await getItem(makeReq('GET', `/api/v1/catalogue/items/${chair.id}`, sm.as), { params: { id: chair.id } })).json());
    expect(v.balances).toEqual([]);
  });
});

describe('search and low stock (003 US7)', () => {
  it('finds items by part of a name or a current or former code, with filters', async () => {
    const admin = await webSessionFor(['admin']);
    const cat = await category(admin.as);
    await item(admin.as, { name: 'White Chiavari Chair', categoryId: cat, trackingType: 'counted', minimumStock: '50' });
    await item(admin.as, { name: 'Brass lantern', categoryId: cat, trackingType: 'counted' });
    const q = async (qs: string) => itemListSchema.parse(await (await listItems(makeReq('GET', `/api/v1/catalogue/items?${qs}`, admin.as))).json()).items.map((i) => i.name);
    expect(await q('q=chiav')).toEqual(['White Chiavari Chair']);
    expect(await q('q=ITM-00002')).toEqual(['Brass lantern']);
    expect(await q('belowMinimum=true')).toEqual(['White Chiavari Chair']);
  });

  it('alerts once when available stock crosses below the minimum', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as, '21');
    await getPool().query('UPDATE items SET minimum_stock = 20 WHERE id = $1', [chair.id]);
    const take = (n: string) => withTransaction((tx) => postMovements(tx, [{ type: 'adjustment', itemId: chair.id, quantity: n, from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { condition: 'lost' }, reason: 'x' }], { actorUserId: admin.user.id }));
    await take('2'); // 21 → 19: crossed
    await take('1'); // 19 → 18: still below, no new alert
    const { rows } = await getPool().query("SELECT payload FROM notification_outbox WHERE trigger = 'stock.low'");
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ itemId: chair.id, available: '19.000', minimum: '20.000' });
  });
});
