import { t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import NewUser from './NewUser';

export default async function NewUserPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'users.manage')) return <Forbidden />;
  return (
    <section className="card">
      <h2>{t('users.new')}</h2>
      <NewUser isSuperAdmin={auth.user.roles.includes('super_admin')} />
    </section>
  );
}
