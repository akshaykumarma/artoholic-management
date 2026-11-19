import { t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import { getPreferences } from '@/server/notifications/centre';
import PreferencesForm from './PreferencesForm';

export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  const auth = await requirePageAuth();
  return (
    <section className="card">
      <h2>{t('ntf.settings')}</h2>
      <PreferencesForm initial={await getPreferences(auth)} />
    </section>
  );
}
