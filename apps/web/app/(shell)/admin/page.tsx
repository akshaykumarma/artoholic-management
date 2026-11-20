import Link from 'next/link';
import { t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';

export const dynamic = 'force-dynamic';

const PAGES: Array<[string, MessageKey, 'all' | 'super']> = [
  ['/admin/audit', 'adm.audit', 'all'], ['/admin/imports', 'adm.imports', 'all'], ['/admin/activity', 'adm.activity', 'super'],
  ['/admin/profile', 'adm.profile', 'super'], ['/admin/lists', 'adm.lists', 'super'], ['/admin/integrations', 'adm.integrations', 'super'],
  ['/admin/messages', 'adm.messages', 'super'], ['/admin/backups', 'adm.backups', 'super'], ['/admin/retention', 'adm.retention', 'super'], ['/admin/releases', 'rel.title', 'super'], ['/admin/deletion-requests', 'del.title', 'all'], ['/admin/status', 'adm.status', 'super']
];

export default async function ConsolePage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'audit.view')) return <Forbidden />;
  const superAdmin = auth.user.roles.includes('super_admin');
  return (
    <section className="card">
      <h2>{t('adm.title')}</h2>
      <ul>{PAGES.filter(([, , who]) => who === 'all' || superAdmin).map(([href, key]) => <li key={href}><Link href={href}>{t(key)}</Link></li>)}</ul>
    </section>
  );
}
