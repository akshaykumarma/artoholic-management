import { formatPhone, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getUser } from '@/server/users/service';
import UserDetail from './UserDetail';

export const dynamic = 'force-dynamic';

export default async function UserPage({ params }: { params: { id: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'users.manage')) return <Forbidden />;
  const user = await getUser(params.id).catch(() => null);
  if (!user) return <section className="card"><p>{t('error.NOT_FOUND')}</p></section>;
  return (
    <section className="card">
      <h2>{user.fullName}</h2>
      <p className="muted">
        {user.username} · {user.phone ? formatPhone(user.phone) : '—'} · {user.roles.map((r) => t(`role.${r}`)).join(', ')} · {t(`users.status.${user.status}`)}
      </p>
      {user.mustChangePassword ? <p>{t('users.mustChange')}</p> : null}
      <UserDetail user={user} isSuperAdmin={auth.user.roles.includes('super_admin')} isSelf={auth.user.id === user.id} />
    </section>
  );
}
