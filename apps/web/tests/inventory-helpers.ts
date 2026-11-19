import { makeReq } from './request';
import { POST as postCategory } from '../app/api/v1/catalogue/categories/route';
import { POST as postItem } from '../app/api/v1/catalogue/items/route';
import { POST as postWarehouse } from '../app/api/v1/warehouses/route';
import { POST as postOpening } from '../app/api/v1/stock/opening/route';

type As = { cookies: Record<string, string>; csrf: string };

export async function category(as: As, name = 'Furniture', parentId?: string): Promise<string> {
  const res = await postCategory(makeReq('POST', '/api/v1/catalogue/categories', { ...as, body: { name, parentId } }));
  if (res.status !== 201) throw new Error(`category ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

export async function item(as: As, body: Record<string, unknown>): Promise<{ id: string; code: string }> {
  const res = await postItem(makeReq('POST', '/api/v1/catalogue/items', { ...as, body: { replacementValuePaise: 50000, ...body } }));
  if (res.status !== 201) throw new Error(`item ${res.status} ${await res.text()}`);
  return res.json();
}

export async function warehouse(as: As, code = 'MAIN'): Promise<{ id: string; defaultLocationId: string }> {
  const res = await postWarehouse(makeReq('POST', '/api/v1/warehouses', { ...as, body: { code, name: `${code} warehouse` } }));
  if (res.status !== 201) throw new Error(`warehouse ${res.status} ${await res.text()}`);
  return res.json();
}

export async function opening(as: As, lines: Array<Record<string, unknown>>): Promise<Response> {
  return postOpening(makeReq('POST', '/api/v1/stock/opening', { ...as, body: { lines } }));
}

/** A category, a counted chair item and a warehouse with 40 chairs available. */
export async function basicStock(as: As, qty = '40') {
  const cat = await category(as);
  const chair = await item(as, { name: 'White Chiavari Chair', categoryId: cat, trackingType: 'counted' });
  const wh = await warehouse(as);
  const res = await opening(as, [{ itemId: chair.id, locationId: wh.defaultLocationId, quantity: qty }]);
  if (res.status !== 201) throw new Error(`opening ${res.status} ${await res.text()}`);
  return { cat, chair, wh };
}
