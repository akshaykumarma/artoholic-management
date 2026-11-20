/**
 * Demo data for local testing: one user per role, two warehouses (MAIN with bins), items with stock,
 * and a scheduled event ready for its dispatch checklist. Runs through the app's own services, so it
 * obeys the same rules as the screens. Refuses to run twice or in production.
 * Usage: npm run seed:demo   (after db:migrate and seed:super-admin)
 */
import path from 'node:path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../../../.env') });

const PASSWORD = process.env.DEMO_PASSWORD ?? 'artoholic-demo-2026';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('The demo seed never runs in production.');
  const { getPool, closePool } = await import('../db/client');
  const { createUser } = await import('../server/users/service');
  const { createWarehouse } = await import('../server/warehouses/basic');
  const { updateWarehouse, createBulk, listLocations } = await import('../server/warehouses/service');
  const { createCategory } = await import('../server/catalogue/categories');
  const { createItem } = await import('../server/catalogue/items');
  const { openingStock } = await import('../server/stock/operations');
  const { createEvent } = await import('../server/events/events');
  const pool = getPool();
  try {
    const { rows: sa } = await pool.query<{ id: string; full_name: string; username: string }>(
      "SELECT u.id, u.full_name, u.username FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'super_admin' LIMIT 1"
    );
    if (!sa[0]) throw new Error('Create the Super Admin first: npm run seed:super-admin');
    if ((await pool.query("SELECT 1 FROM warehouses WHERE code = 'MAIN'")).rowCount) throw new Error('Demo data is already there; nothing was changed.');
    const auth = {
      user: { id: sa[0].id, fullName: sa[0].full_name, username: sa[0].username, roles: ['super_admin' as const], mustChangePassword: false },
      session: { id: '00000000-0000-0000-0000-000000000000', platform: 'web' as const, expiresAt: new Date(Date.now() + 3600_000), idleTimeoutMinutes: 60 }
    };
    const ctx = { platform: 'web' as const, version: 'seed', ip: null, cookies: {}, bearer: null };

    const people = [
      { fullName: 'Asha Admin', username: 'asha', phone: '+919800000101', email: 'asha@artoholic.test', roles: ['admin' as const] },
      { fullName: 'Meera Event Manager', username: 'meera', phone: '+919800000102', email: 'meera@artoholic.test', roles: ['event_manager' as const] },
      { fullName: 'Ravi Store Manager', username: 'ravi', phone: '+919800000103', email: 'ravi@artoholic.test', roles: ['store_manager' as const] }
    ];
    const ids: Record<string, string> = {};
    for (const p of people) {
      const u = await createUser(auth, { ...p, temporaryPassword: PASSWORD }, ctx);
      ids[p.username] = u.id;
    }
    // Demo accounts sign in straight away (real users must change their temporary password).
    await pool.query('UPDATE users SET must_change_password = false WHERE id = ANY($1::uuid[])', [Object.values(ids)]);

    const main = await createWarehouse(auth, { code: 'MAIN', name: 'Main warehouse, Peenya' }, ctx);
    await updateWarehouse(auth, main.id, { levels: ['Aisle', 'Row'], address: 'Plot 4, Peenya Industrial Area, Bengaluru', storeManagerIds: [ids.ravi!] }, ctx);
    await createBulk(auth, main.id, null, [{ from: 'A', to: 'C' }, { from: 1, to: 4 }], ctx);
    const bins = await listLocations(auth, main.id, { q: 'MAIN-' });
    const bin = (code: string) => bins.find((b) => b.code === code)!.id;
    const north = await createWarehouse(auth, { code: 'NORTH', name: 'North godown, Yelahanka' }, ctx);

    const furniture = await createCategory(auth, { name: 'Furniture' }, ctx);
    const lighting = await createCategory(auth, { name: 'Lighting' }, ctx);
    const fabric = await createCategory(auth, { name: 'Fabric and drapes' }, ctx);
    const chair = await createItem(auth, { name: 'White Chiavari Chair', categoryId: furniture.id, trackingType: 'counted', replacementValuePaise: 150000, minimumStock: '50', description: '' } as never, ctx);
    const table = await createItem(auth, { name: 'Round Banquet Table 6 ft', categoryId: furniture.id, trackingType: 'counted', replacementValuePaise: 600000, description: '' } as never, ctx);
    const lights = await createItem(auth, { name: 'Warm Fairy Light String 10 m', categoryId: lighting.id, trackingType: 'counted', replacementValuePaise: 80000, minimumStock: '20', description: '' } as never, ctx);
    const drape = await createItem(auth, { name: 'Ivory Satin Drape', categoryId: fabric.id, trackingType: 'measured', unitCode: 'm', replacementValuePaise: 25000, description: '' } as never, ctx);
    await openingStock(auth, [
      { itemId: chair.id, locationId: bin('MAIN-A-01'), condition: 'available', quantity: '200' },
      { itemId: table.id, locationId: bin('MAIN-A-02'), condition: 'available', quantity: '30' },
      { itemId: lights.id, locationId: bin('MAIN-B-01'), condition: 'available', quantity: '120' },
      { itemId: drape.id, locationId: bin('MAIN-C-01'), condition: 'available', quantity: '400' },
      { itemId: chair.id, locationId: north.defaultLocationId!, condition: 'available', quantity: '60' }
    ], ctx);

    const day = 86_400_000;
    const at = (d: number, h: number) => { const x = new Date(Date.now() + d * day); x.setUTCHours(h - 5, 30, 0, 0); return x.toISOString(); };
    const ret = new Date(Date.now() + 4 * day + 330 * 60_000).toISOString().slice(0, 10);
    const ev = await createEvent(auth, {
      name: 'Sharma–Verma Wedding Reception', venueName: 'Palace Grounds, Gate 3', venueAddress: 'Jayamahal Road, Bengaluru',
      startsAt: at(2, 18), endsAt: at(2, 23), leaveWarehouseAt: at(2, 9), expectedReturnDate: ret, siteContactName: 'Rohit Sharma', siteContactPhone: '+919800000201',
      eventManagerIds: [ids.meera!], storeManagerIds: [ids.ravi!], notes: 'Demo event created by seed:demo',
      lines: [
        { itemId: chair.id, plannedQty: '150', sources: [{ type: 'warehouse', warehouseId: main.id, qty: '150' }] },
        { itemId: table.id, plannedQty: '20', sources: [{ type: 'warehouse', warehouseId: main.id, qty: '20' }] },
        { itemId: lights.id, plannedQty: '40', sources: [{ type: 'warehouse', warehouseId: main.id, qty: '40' }] },
        { itemId: drape.id, plannedQty: '60', sources: [{ type: 'warehouse', warehouseId: main.id, qty: '60' }] }
      ], schedule: true
    }, ctx);

    console.log(`Demo data created. Event ${ev.number} is scheduled and ready for Ravi's dispatch checklist.`);
    console.log(`Sign in as asha (Admin), meera (Event Manager) or ravi (Store Manager) with password: ${PASSWORD}`);
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
