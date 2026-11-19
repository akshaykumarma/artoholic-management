import Link from 'next/link';
import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { eventActivity } from '@/server/events/activity';

export const dynamic = 'force-dynamic';

/** Full text of every message stays in the log (owner decision); one-time codes never appear in event messages. */
export default async function ActivityPage({ params }: { params: { id: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.view')) return <Forbidden />;
  const a = await eventActivity(auth, params.id).catch(() => null);
  if (!a) return <Forbidden />;
  return (
    <section className="card">
      <p><Link href={`/events/${params.id}`}>{t('ev.title')}</Link></p>
      <h2>{t('ck.activity')}</h2>
      <table>
        <tbody>
          {a.items.map((x, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap' }}>{formatDateTimeIST(x.at)}</td>
              <td>{x.actor ?? ''}</td>
              <td>{x.action}</td>
              <td><code style={{ fontSize: 12, wordBreak: 'break-word' }}>{x.detail ? JSON.stringify(x.detail) : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
