import { describe, it, expect } from 'vitest';
import { getPool, withTransaction } from '../../db/client';
import { postMovements } from '../../server/stock/post';
import { rebuildMismatches, balanceOf } from '../../server/stock/balances';
import { webSessionFor } from '../session-helpers';
import { basicStock } from '../inventory-helpers';

describe('stock ledger (constitution II, 003 US3)', () => {
  it('moves quantities between conditions and keeps the cache equal to the ledger', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    await withTransaction((tx) =>
      postMovements(tx, [{ type: 'damage', itemId: chair.id, quantity: '3', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { locationId: wh.defaultLocationId, condition: 'damaged' }, reason: 'found broken' }], { actorUserId: admin.user.id })
    );
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('37.000');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'damaged')).toBe('3.000');
    expect(await rebuildMismatches(getPool())).toEqual([]);
  });

  it('refuses a movement that would make stock negative, naming what is available', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    await expect(
      withTransaction((tx) => postMovements(tx, [{ type: 'adjustment', itemId: chair.id, quantity: '41', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { condition: 'lost' }, reason: 'x' }], { actorUserId: admin.user.id }))
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: '40.000', condition: 'available' } });
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('40.000');
  });

  it('two parallel debits of 30 on 40: exactly one succeeds', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    const debit = () =>
      withTransaction((tx) => postMovements(tx, [{ type: 'adjustment', itemId: chair.id, quantity: '30', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { condition: 'lost' }, reason: 'x' }], { actorUserId: admin.user.id }));
    const results = await Promise.allSettled([debit(), debit()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('10.000');
  });

  it('ledger rows can never be edited or deleted', async () => {
    const admin = await webSessionFor(['admin']);
    await basicStock(admin.as);
    await expect(getPool().query("UPDATE stock_movements SET reason = 'x'")).rejects.toThrow(/append-only/);
    await expect(getPool().query('DELETE FROM stock_movements')).rejects.toThrow(/append-only/);
  });

  it('a correction references the movement it corrects', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    const [orig] = await withTransaction((tx) => postMovements(tx, [{ type: 'adjustment', itemId: chair.id, quantity: '5', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { condition: 'lost' }, reason: 'miscount' }], { actorUserId: admin.user.id }));
    await withTransaction((tx) => postMovements(tx, [{ type: 'correction', itemId: chair.id, quantity: '5', from: { condition: 'lost' }, to: { locationId: wh.defaultLocationId, condition: 'available' }, reason: 'found them', correctsMovementId: orig }], { actorUserId: admin.user.id }));
    const { rows } = await getPool().query('SELECT corrects_movement_id FROM stock_movements WHERE type = $1', ['correction']);
    expect(Number(rows[0].corrects_movement_id)).toBe(orig);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('40.000');
  });

  it('counted items accept whole numbers only', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair, wh } = await basicStock(admin.as);
    await expect(
      withTransaction((tx) => postMovements(tx, [{ type: 'adjustment', itemId: chair.id, quantity: '1.5', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { condition: 'lost' }, reason: 'x' }], { actorUserId: admin.user.id }))
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
