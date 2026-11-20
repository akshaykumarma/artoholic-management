import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listDeletionRequests } from '@/server/deletion';
import CompleteButton from './CompleteButton';

export const dynamic = 'force-dynamic';

export default async function DeletionRequestsPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'users.manage')) return <Forbidden />;
  const items = await listDeletionRequests();
  return (
    <section className="card">
      <h2>{t('del.title')}</h2>
      {items.length ? (
        <table>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.userName}</td>
                <td>{formatDateTimeIST(r.requestedAt)}</td>
                <td>{r.status === 'pending' ? t('del.due', { date: formatDateTimeIST(r.dueAt) }) : r.status}</td>
                <td>{r.status === 'pending' ? <CompleteButton id={r.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">{t('del.none')}</p>}
    </section>
  );
}
