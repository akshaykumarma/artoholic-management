import { describe, it, expect } from 'vitest';
import { cutResultSchema, itemViewSchema } from '@artoholic/shared';
import { POST as postCut } from '../../app/api/v1/stock/cuts/route';
import { GET as getItem } from '../../app/api/v1/catalogue/items/[id]/route';
import { webSessionFor } from '../session-helpers';
import { category, item, warehouse, opening } from '../inventory-helpers';
import { makeReq } from '../request';

async function carpet() {
  const admin = await webSessionFor(['admin']);
  const cat = await category(admin.as, 'Floor');
  const it = await item(admin.as, { name: 'Red carpet roll', categoryId: cat, trackingType: 'cut', unitCode: 'm', minimumUsableLength: '2' });
  const wh = await warehouse(admin.as);
  expect((await opening(admin.as, [{ itemId: it.id, locationId: wh.defaultLocationId, quantity: '30' }])).status).toBe(201);
  const view = async () => itemViewSchema.parse(await (await getItem(makeReq('GET', `/api/v1/catalogue/items/${it.id}`, admin.as), { params: { id: it.id } })).json());
  return { admin, it, wh, view };
}

describe('cut products piece by piece (003 US4)', () => {
  it('opening stock creates a numbered piece', async () => {
    const { view, it } = await carpet();
    const v = await view();
    expect(v.pieces).toHaveLength(1);
    expect(v.pieces[0]!.pieceNumber).toBe(`${it.code}-P1`);
    expect(v.pieces[0]!.currentLength).toBe('30.000');
  });

  it('a 12 m cut leaves an 18 m offcut; the item total stays 30 m', async () => {
    const { admin, view } = await carpet();
    const roll = (await view()).pieces[0]!;
    const res = await postCut(makeReq('POST', '/api/v1/stock/cuts', { ...admin.as, body: { pieceId: roll.id, length: '12' } }));
    expect(res.status).toBe(201);
    const r = cutResultSchema.parse(await res.json());
    expect(r.cutPiece.length).toBe('12.000');
    expect(r.offcut.length).toBe('18.000');
    expect(r.cutPiece.pieceNumber).toBe(`${roll.pieceNumber}.1`);
    const v = await view();
    expect(v.totals.available).toBe('30.000');
    expect(v.pieces.map((p) => p.currentLength).sort()).toEqual(['12.000', '18.000']);
  });

  it('cannot cut more than the piece holds', async () => {
    const { admin, view } = await carpet();
    const roll = (await view()).pieces[0]!;
    const res = await postCut(makeReq('POST', '/api/v1/stock/cuts', { ...admin.as, body: { pieceId: roll.id, length: '30.5' } }));
    expect(res.status).toBe(409);
  });

  it('flags pieces below the minimum usable length', async () => {
    const { admin, view } = await carpet();
    const roll = (await view()).pieces[0]!;
    await postCut(makeReq('POST', '/api/v1/stock/cuts', { ...admin.as, body: { pieceId: roll.id, length: '28.5' } }));
    const v = await view();
    const offcut = v.pieces.find((p) => p.currentLength === '1.500')!;
    expect(offcut.belowMinimum).toBe(true);
  });
});
