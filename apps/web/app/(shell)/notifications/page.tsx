import Link from 'next/link';
import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import { listNotifications } from '@/server/notifications/centre';
import NotificationActions from './NotificationActions';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const auth = await requirePageAuth();
  const { items, unread } = await listNotifications(auth, {});
  return (
    <section className="card">
      <h2>{t('ntf.title')}</h2>
      <p style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>{t('ntf.unread', { n: unread })}</span>
        <Link href="/settings/notifications">{t('ntf.settings')}</Link>
      </p>
      <NotificationActions items={items.map((n) => ({ id: n.id, title: n.title, body: n.body, path: n.path, when: formatDateTimeIST(n.createdAt), unread: !n.readAt }))} />
    </section>
  );
}
