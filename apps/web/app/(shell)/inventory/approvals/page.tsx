import { formatDateTimeIST, formatQuantity, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listRequests } from '@/server/stock/operations';
import Decide from './Decide';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'stock.approve')) return <Forbidden />;
  const items = await listRequests('pending');
  return (
    <section className="card">
      <h2>{t('inv.approvals')}</h2>
      {items.length === 0 ? <p>{t('inv.noRequests')}</p> : (
        <table>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{formatDateTimeIST(r.requestedAt)}</td><td>{r.kind === 'write_off' ? t('inv.writeOff') : t('inv.correct')}</td>
                <td>{r.itemName}</td><td>{r.locationCode ?? '—'}</td><td>{formatQuantity(r.quantityChange.replace('-', '')) + (r.quantityChange.startsWith('-') ? ' −' : ' +')}</td>
                <td>{r.reason}</td><td>{r.requestedBy}</td><td><Decide id={r.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
