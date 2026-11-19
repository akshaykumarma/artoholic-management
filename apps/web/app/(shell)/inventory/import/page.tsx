import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import ImportForm from './ImportForm';

export default async function ImportPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'catalogue.manage')) return <Forbidden />;
  return <ImportForm />;
}
