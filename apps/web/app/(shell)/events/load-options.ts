import 'server-only';
import { listItems } from '@/server/catalogue/items';
import { listActiveWarehouses } from '@/server/warehouses/basic';
import { listUsers } from '@/server/users/service';
import { listEventTypes } from '@/server/events/views';

/** Choices for the event form. */
export async function eventFormOptions() {
  const [items, warehouses, ems, sms, types] = await Promise.all([
    listItems({}), listActiveWarehouses(), listUsers({ role: 'event_manager', status: 'active' }), listUsers({ role: 'store_manager', status: 'active' }), listEventTypes()
  ]);
  return {
    items: items.items.filter((i) => i.status === 'active').map((i) => ({ id: i.id, label: `${i.code} · ${i.name}` })),
    warehouses: warehouses.map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` })),
    eventManagers: ems.items.map((u) => ({ id: u.id, label: u.fullName })),
    storeManagers: sms.items.map((u) => ({ id: u.id, label: u.fullName })),
    types: types.map((x) => ({ id: x.id, label: x.name }))
  };
}
