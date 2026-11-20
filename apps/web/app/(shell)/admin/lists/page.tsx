import { t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { LISTS, listValues } from '@/server/admin/settings';
import ListEditor from './ListEditor';

export const dynamic = 'force-dynamic';

export default async function ListsPage() {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  const lists = await Promise.all(LISTS.map(async (l) => ({ list: l, values: await listValues(l) })));
  return (
    <>
      <section className="card"><h2>{t('adm.lists')}</h2></section>
      {lists.map(({ list, values }) => (
        <section key={list} className="card">
          <h3>{t(`adm.list.${list}` as MessageKey)}</h3>
          <ListEditor list={list} values={values} canAdd={list !== 'unit'} />
        </section>
      ))}
    </>
  );
}
