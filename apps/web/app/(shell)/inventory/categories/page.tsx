import { t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listCategories } from '@/server/catalogue/categories';
import { listUnits } from '@/server/catalogue/units';
import CategoryAdmin from './CategoryAdmin';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'catalogue.manage')) return <Forbidden />;
  const units = await listUnits();
  return (
    <>
      <CategoryAdmin categories={await listCategories()} />
      <section className="card">
        <h2>{t('inv.units')}</h2>
        <table><tbody>{units.map((u) => <tr key={u.code}><td>{u.code}</td><td>{u.name}</td><td>{u.family}</td><td>{u.factorToBase}</td></tr>)}</tbody></table>
      </section>
    </>
  );
}
