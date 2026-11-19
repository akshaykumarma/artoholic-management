import Link from 'next/link';
import { t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getProvider, listTemplates } from '@/server/notifications/admin';
import IntegrationForms from './IntegrationForms';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  return (
    <>
      <section className="card">
        <h2>{t('int.title')}</h2>
        <p><Link href="/admin/messages">{t('msg.title')}</Link></p>
      </section>
      <IntegrationForms whatsapp={await getProvider('whatsapp')} email={await getProvider('email')} templates={await listTemplates()} />
    </>
  );
}
