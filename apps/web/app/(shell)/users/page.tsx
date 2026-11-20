import Link from 'next/link';
import { formatPhone, ROLES, t, type Role } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listUsers } from '@/server/users/service';
import UserRowActions from './UserRowActions';

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }: { searchParams: { q?: string; role?: string; status?: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'users.manage')) return <Forbidden />;
  const role = ROLES.includes(searchParams.role as Role) ? (searchParams.role as Role) : undefined;
  const status = searchParams.status === 'active' || searchParams.status === 'deactivated' ? searchParams.status : undefined;
  const { items } = await listUsers({ q: searchParams.q, role, status });
  const isSuperAdmin = auth.user.roles.includes('super_admin');
  return (
    <section className="card">
      <h2>{t('users.title')}</h2>
      <p><Link href="/users/new">{t('users.new')}</Link></p>
      <form method="get" role="search" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label htmlFor="q">{t('users.search')}</label>
          <input id="q" name="q" defaultValue={searchParams.q ?? ''} />
        </div>
        <div>
          <label htmlFor="role">{t('users.roles')}</label>
          <select id="role" name="role" defaultValue={role ?? ''} style={{ minHeight: 44 }}>
            <option value="">—</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status">{t('users.status')}</label>
          <select id="status" name="status" defaultValue={status ?? ''} style={{ minHeight: 44 }}>
            <option value="">—</option>
            <option value="active">{t('users.status.active')}</option>
            <option value="deactivated">{t('users.status.deactivated')}</option>
          </select>
        </div>
        <button type="submit">{t('users.searchButton')}</button>
      </form>
      {items.length === 0 ? <p>{t('users.empty')}</p> : (
        <table>
          <thead>
            <tr><th>{t('users.fullName')}</th><th>{t('signIn.username')}</th><th>{t('users.phone')}</th><th>{t('users.roles')}</th><th>{t('users.status')}</th><th>{t('users.actions')}</th></tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/users/${u.id}`}>{u.fullName}</Link></td>
                <td>{u.username}</td>
                <td>{u.phone ? formatPhone(u.phone) : '—'}</td>
                <td>{u.roles.map((r) => t(`role.${r}`)).join(', ')}</td>
                <td><span className={`pill ${u.status === 'active' ? 'st-closed' : 'st-cancelled'}`}>{t(`users.status.${u.status}`)}</span>{u.id === auth.user.id ? <span className="muted">{` · ${t('users.you')}`}</span> : null}</td>
                <td><UserRowActions user={u} isSuperAdmin={isSuperAdmin} isSelf={u.id === auth.user.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
