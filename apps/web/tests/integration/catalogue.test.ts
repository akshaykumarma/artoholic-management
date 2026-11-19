import { describe, it, expect } from 'vitest';
import { itemViewSchema, itemListSchema } from '@artoholic/shared';
import { POST as postItem, GET as listItems } from '../../app/api/v1/catalogue/items/route';
import { GET as getItem, PATCH as patchItem } from '../../app/api/v1/catalogue/items/[id]/route';
import { PATCH as patchCategory } from '../../app/api/v1/catalogue/categories/[id]/route';
import { GET as listUnits } from '../../app/api/v1/catalogue/units/route';
import { webSessionFor } from '../session-helpers';
import { category, item, basicStock, warehouse, opening } from '../inventory-helpers';
import { makeReq } from '../request';

describe('catalogue (003 US1)', () => {
  it('auto-codes items ITM-NNNNN, or uses a typed code', async () => {
    const admin = await webSessionFor(['admin']);
    const cat = await category(admin.as);
    expect((await item(admin.as, { name: 'Chair', categoryId: cat, trackingType: 'counted' })).code).toBe('ITM-00001');
    expect((await item(admin.as, { name: 'Table', categoryId: cat, trackingType: 'counted', code: 'TBL-ROUND-01' })).code).toBe('TBL-ROUND-01');
  });

  it('enforces the unit rule per tracking type', async () => {
    const admin = await webSessionFor(['admin']);
    const cat = await category(admin.as);
    const bad1 = await postItem(makeReq('POST', '/api/v1/catalogue/items', { ...admin.as, body: { name: 'Chair', categoryId: cat, trackingType: 'counted', unitCode: 'm', replacementValuePaise: 0 } }));
    const bad2 = await postItem(makeReq('POST', '/api/v1/catalogue/items', { ...admin.as, body: { name: 'Rope', categoryId: cat, trackingType: 'measured', replacementValuePaise: 0 } }));
    expect(bad1.status).toBe(400);
    expect(bad2.status).toBe(400);
    expect((await item(admin.as, { name: 'Rope', categoryId: cat, trackingType: 'measured', unitCode: 'm' })).code).toMatch(/^ITM-/);
  });

  it('item codes can change; old codes still find the item and are never reused', async () => {
    const admin = await webSessionFor(['admin']);
    const cat = await category(admin.as);
    const chair = await item(admin.as, { name: 'Chair', categoryId: cat, trackingType: 'counted' });
    const view = itemViewSchema.parse(await (await getItem(makeReq('GET', `/api/v1/catalogue/items/${chair.id}`, admin.as), { params: { id: chair.id } })).json());
    const res = await patchItem(makeReq('PATCH', `/api/v1/catalogue/items/${chair.id}`, { ...admin.as, headers: { 'if-match': view.item.updatedAt }, body: { code: 'CHR-WHITE-01' } }), { params: { id: chair.id } });
    expect(res.status).toBe(200);
    const found = itemListSchema.parse(await (await listItems(makeReq('GET', '/api/v1/catalogue/items?q=ITM-00001', admin.as))).json());
    expect(found.items.map((i) => i.code)).toEqual(['CHR-WHITE-01']);
    const reuse = await postItem(makeReq('POST', '/api/v1/catalogue/items', { ...admin.as, body: { name: 'Other', categoryId: cat, trackingType: 'counted', code: 'ITM-00001', replacementValuePaise: 0 } }));
    expect(reuse.status).toBe(409);
    expect((await reuse.json()).error.code).toBe('CODE_TAKEN');
  });

  it('tracking type is locked once the item has stock movements', async () => {
    const admin = await webSessionFor(['admin']);
    const { chair } = await basicStock(admin.as);
    const view = await (await getItem(makeReq('GET', `/api/v1/catalogue/items/${chair.id}`, admin.as), { params: { id: chair.id } })).json();
    const res = await patchItem(makeReq('PATCH', `/api/v1/catalogue/items/${chair.id}`, { ...admin.as, headers: { 'if-match': view.item.updatedAt }, body: { unitCode: 'm' } }), { params: { id: chair.id } });
    expect(res.status).toBe(400);
  });

  it('a category in use can be archived but not deleted; archived items are hidden from new work', async () => {
    const admin = await webSessionFor(['admin']);
    const cat = await category(admin.as);
    await item(admin.as, { name: 'Chair', categoryId: cat, trackingType: 'counted' });
    const res = await patchCategory(makeReq('PATCH', `/api/v1/catalogue/categories/${cat}`, { ...admin.as, body: { status: 'archived' } }), { params: { id: cat } });
    expect(res.status).toBe(200);
    const blocked = await postItem(makeReq('POST', '/api/v1/catalogue/items', { ...admin.as, body: { name: 'New', categoryId: cat, trackingType: 'counted', replacementValuePaise: 0 } }));
    expect(blocked.status).toBe(409);
  });

  it('two-level categories only', async () => {
    const admin = await webSessionFor(['admin']);
    const top = await category(admin.as, 'Furniture');
    const sub = await category(admin.as, 'Chairs', top);
    await expect(category(admin.as, 'Too deep', sub)).rejects.toThrow(/400/);
  });

  it('converts entered units within a family (150 cm → 1.5 m)', async () => {
    const admin = await webSessionFor(['admin']);
    const cat = await category(admin.as);
    const rope = await item(admin.as, { name: 'Jute rope', categoryId: cat, trackingType: 'measured', unitCode: 'm' });
    const wh = await warehouse(admin.as);
    expect((await opening(admin.as, [{ itemId: rope.id, locationId: wh.defaultLocationId, quantity: '150', unit: 'cm' }])).status).toBe(201);
    const view = itemViewSchema.parse(await (await getItem(makeReq('GET', `/api/v1/catalogue/items/${rope.id}`, admin.as), { params: { id: rope.id } })).json());
    expect(view.totals.available).toBe('1.500');
    const wrongFamily = await opening(admin.as, [{ itemId: rope.id, locationId: wh.defaultLocationId, quantity: '1', unit: 'kg' }]);
    expect(wrongFamily.status).toBe(400);
  });

  it('Event Managers can view but not manage the catalogue', async () => {
    const admin = await webSessionFor(['admin']);
    await basicStock(admin.as);
    const em = await webSessionFor(['event_manager']);
    expect((await listItems(makeReq('GET', '/api/v1/catalogue/items', em.as))).status).toBe(200);
    expect((await listUnits(makeReq('GET', '/api/v1/catalogue/units', em.as))).status).toBe(200);
    const res = await postItem(makeReq('POST', '/api/v1/catalogue/items', { ...em.as, body: { name: 'x', categoryId: (await category(admin.as, 'Other')), trackingType: 'counted', replacementValuePaise: 0 } }));
    expect(res.status).toBe(403);
  });
});
