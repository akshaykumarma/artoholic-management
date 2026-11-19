import { buildMenu, t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';

export default async function HomePage() {
  const auth = await requirePageAuth();
  const roles = auth.user.roles.map((r) => t(`role.${r}`)).join(', ');
  const modules = buildMenu(auth.user.roles, 'web').filter((m) => m.moduleId !== 'home');
  return (
    <section className="card">
      <h2>{t('home.welcome', { name: auth.user.fullName })}</h2>
      <p className="muted">{t('home.roles', { roles: roles || '—' })}</p>
      {auth.user.roles.length === 0 || modules.length === 0 ? <p>{t('home.noModules')}</p> : null}
    </section>
  );
}
