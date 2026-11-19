import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listMessages } from '@/server/notifications/admin';

export const dynamic = 'force-dynamic';

/** The permanent WhatsApp and email log, full text with one-time codes redacted (US5). */
export default async function MessagesPage({ searchParams }: { searchParams: { q?: string; channel?: string } }) {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  const channel = searchParams.channel === 'whatsapp' || searchParams.channel === 'email' ? searchParams.channel : undefined;
  const items = await listMessages({ q: searchParams.q, channel });
  return (
    <section className="card">
      <h2>{t('msg.title')}</h2>
      <form method="get" role="search" style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="msg-q">{t('msg.search')}</label>
          <input id="msg-q" name="q" defaultValue={searchParams.q ?? ''} />
        </div>
        <button type="submit">{t('ev.filter')}</button>
      </form>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>{t('msg.when')}</th><th>{t('msg.channel')}</th><th>{t('msg.to')}</th><th>{t('msg.text')}</th><th>{t('msg.status')}</th></tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateTimeIST(m.queuedAt)}</td>
                <td>{m.channel}</td>
                <td>{m.toAddress}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{m.renderedText}<div className="muted">{m.trigger}</div></td>
                <td>{m.status}<div className="muted">{m.events.map((e) => `${e.status}${e.detail ? ` (${e.detail})` : ''}`).join(' → ')}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
