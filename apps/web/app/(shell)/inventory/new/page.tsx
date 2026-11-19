import { t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import ItemForm from '@/components/ItemForm';
import { listCategories } from '@/server/catalogue/categories';
import { listUnits } from '@/server/catalogue/units';

export default async function NewItemPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'catalogue.manage')) return <Forbidden />;
  return (
    <>
      <h2>{t('inv.newItem')}</h2>
      <ItemForm categories={await listCategories()} units={await listUnits()} />
    </>
  );
}
