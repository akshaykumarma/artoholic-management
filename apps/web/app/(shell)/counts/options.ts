import 'server-only';
import { listActiveWarehouses } from '@/server/warehouses/basic';
import { listCategories } from '@/server/catalogue/categories';
import { listUsers } from '@/server/users/service';

export async function countOptions() {
  const [wh, cats, sms] = await Promise.all([listActiveWarehouses(), listCategories(), listUsers({ role: 'store_manager', status: 'active' })]);
  return {
    warehouses: wh.map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` })),
    categories: cats.filter((c) => c.status === 'active').map((c) => ({ id: c.id, label: c.name })),
    managers: sms.items.map((u) => ({ id: u.id, label: u.fullName }))
  };
}
