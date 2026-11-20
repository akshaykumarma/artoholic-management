import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import ImportForm from '../../inventory/import/ImportForm';

export const dynamic = 'force-dynamic';

/** Import centre (010 US4): users, categories, items, opening stock and locations. */
export default async function ImportCentrePage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'catalogue.manage')) return <Forbidden />;
  return <ImportForm kinds={['users', 'categories', 'items', 'opening_stock', 'locations']} />;
}
