import { describe, it, expect } from 'vitest';
import { warehouseDetailSchema } from '@artoholic/shared';
import { POST as createWh, GET as listWh } from '../../app/api/v1/warehouses/route';
import { GET as getWh, PATCH as patchWh } from '../../app/api/v1/warehouses/[id]/route';
import { POST as bulk } from '../../app/api/v1/warehouses/[id]/locations/bulk/route';
import { POST as bulkPreview } from '../../app/api/v1/warehouses/[id]/locations/bulk/preview/route';
import { POST as createUserRoute } from '../../app/api/v1/users/route';
import { webSessionFor } from '../session-helpers';
import { makeReq } from '../request';

async function main(as: { cookies: Record<string, string>; csrf: string }, levels = ['Aisle', 'Row', 'Box']) {
  const w = await (await createWh(makeReq('POST', '/api/v1/warehouses', { ...as, body: { code: 'main', name: 'Main' } }))).json();
  const res = await patchWh(makeReq('PATCH', `/api/v1/warehouses/${w.id}`, { ...as, body: { levels, address: 'Plot 4, Peenya' } }), { params: { id: w.id } });
  expect(res.status).toBe(200);
  return w as { id: string };
}

describe('warehouse setup (004 US1)', () => {
  it('upper-cases and validates codes; codes are unique', async () => {
    const admin = await webSessionFor(['admin']);
    const w = await (await createWh(makeReq('POST', '/api/v1/warehouses', { ...admin.as, body: { code: 'main', name: 'Main' } }))).json();
    expect(w.code).toBe('MAIN');
    expect((await createWh(makeReq('POST', '/api/v1/warehouses', { ...admin.as, body: { code: 'MAIN', name: 'Again' } }))).status).toBe(409);
    expect((await createWh(makeReq('POST', '/api/v1/warehouses', { ...admin.as, body: { code: 'TOO-LONG!', name: 'x' } }))).status).toBe(400);
  });

  it('1–5 named levels; the count locks once locations exist, renames still allowed', async () => {
    const admin = await webSessionFor(['admin']);
    const w = await main(admin.as);
    await bulk(makeReq('POST', `/api/v1/warehouses/${w.id}/locations/bulk`, { ...admin.as, body: { ranges: [{ from: 'A', to: 'A' }, { from: 1, to: 1 }, { from: 1, to: 1 }] } }), { params: { id: w.id } });
    const locked = await patchWh(makeReq('PATCH', `/api/v1/warehouses/${w.id}`, { ...admin.as, body: { levels: ['Aisle', 'Row'] } }), { params: { id: w.id } });
    expect((await locked.json()).error.code).toBe('LEVELS_LOCKED');
    const rename = await patchWh(makeReq('PATCH', `/api/v1/warehouses/${w.id}`, { ...admin.as, body: { levels: ['Aisle', 'Rack', 'Box'] } }), { params: { id: w.id } });
    expect(rename.status).toBe(200);
    const six = await patchWh(makeReq('PATCH', `/api/v1/warehouses/${w.id}`, { ...admin.as, body: { levels: ['a', 'b', 'c', 'd', 'e', 'f'] } }), { params: { id: w.id } });
    expect(six.status).toBe(400);
  });

  it('assigns several Store Managers; each sees the warehouse, others do not', async () => {
    const admin = await webSessionFor(['admin']);
    const w = await main(admin.as);
    const mk = async (phone: string, username: string) => (await (await createUserRoute(makeReq('POST', '/api/v1/users', { ...admin.as, body: { fullName: username, phone, username, temporaryPassword: 'marigold-tent-42', roles: ['store_manager'] } }))).json()).id as string;
    const a = await mk('+919800000001', 'suresh');
    const b = await mk('+919800000002', 'kavya');
    const res = await patchWh(makeReq('PATCH', `/api/v1/warehouses/${w.id}`, { ...admin.as, body: { storeManagerIds: [a, b] } }), { params: { id: w.id } });
    const d = warehouseDetailSchema.parse(await res.json());
    expect(d.storeManagers.map((s) => s.fullName).sort()).toEqual(['kavya', 'suresh']);
    const other = await webSessionFor(['store_manager']);
    expect((await (await listWh(makeReq('GET', '/api/v1/warehouses', other.as))).json()).items).toEqual([]);
    expect((await getWh(makeReq('GET', `/api/v1/warehouses/${w.id}`, other.as), { params: { id: w.id } })).status).toBe(403);
  });

  it('refuses a Store Manager role that the user does not hold', async () => {
    const admin = await webSessionFor(['admin']);
    const w = await main(admin.as);
    const em = await webSessionFor(['event_manager']);
    const res = await patchWh(makeReq('PATCH', `/api/v1/warehouses/${w.id}`, { ...admin.as, body: { storeManagerIds: [em.user.id] } }), { params: { id: w.id } });
    expect(res.status).toBe(400);
  });
});

describe('bulk bins (004 US2)', () => {
  it('previews counts and skips existing; creates MAIN-A-01-01 … MAIN-A-03-02', async () => {
    const admin = await webSessionFor(['admin']);
    const w = await main(admin.as);
    const body = { ranges: [{ from: 'A', to: 'A' }, { from: 1, to: 3 }, { from: 1, to: 2 }] };
    const p = await (await bulkPreview(makeReq('POST', '/api/v1/x', { ...admin.as, body }), { params: { id: w.id } })).json();
    expect(p).toMatchObject({ create: 6, skip: [] });
    const made = await (await bulk(makeReq('POST', '/api/v1/x', { ...admin.as, body }), { params: { id: w.id } })).json();
    expect(made.created).toEqual(['MAIN-A-01-01', 'MAIN-A-01-02', 'MAIN-A-02-01', 'MAIN-A-02-02', 'MAIN-A-03-01', 'MAIN-A-03-02']);
    const again = await (await bulkPreview(makeReq('POST', '/api/v1/x', { ...admin.as, body: { ranges: [{ from: 'A', to: 'A' }, { from: 1, to: 4 }, { from: 1, to: 2 }] } }), { params: { id: w.id } })).json();
    expect(again.create).toBe(2);
    expect(again.skip).toHaveLength(6);
  });

  it('refuses more than 2,000 bins in one request and ranges that do not reach bin level', async () => {
    const admin = await webSessionFor(['admin']);
    const w = await main(admin.as);
    const big = await bulk(makeReq('POST', '/api/v1/x', { ...admin.as, body: { ranges: [{ from: 'A', to: 'Z' }, { from: 1, to: 10 }, { from: 1, to: 10 }] } }), { params: { id: w.id } });
    expect(big.status).toBe(400);
    const short = await bulk(makeReq('POST', '/api/v1/x', { ...admin.as, body: { ranges: [{ from: 'A', to: 'B' }] } }), { params: { id: w.id } });
    expect(short.status).toBe(400);
  });
});
