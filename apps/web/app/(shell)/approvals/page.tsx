import Link from 'next/link';
import { formatDateTimeIST, formatQuantity, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { myOpenSteps } from '@/server/checklists/steps';
import { listReports } from '@/server/damage/reports';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.view')) return <Forbidden />;
  const steps = await myOpenSteps(auth);
  const reports = can(auth, 'damage.report') ? await listReports(auth, can(auth, 'damage.approve') ? { status: 'pending' } : {}) : [];
  return (
    <>
      <section className="card">
        <h2>{t('ck.title')}</h2>
        <h3>{t('ck.myTasks')}</h3>
        {steps.length ? (
          <ul>
            {steps.map((s) => (
              <li key={s.stepId}>
                <Link href={`/events/${s.eventId}/checklists/${s.stepId}`}>{[t(`ck.step.${s.step}` as MessageKey), s.warehouseCode, `${s.eventNumber} · ${s.eventName}`].filter(Boolean).join(' · ')}</Link>
                {s.leaveWarehouseAt ? ` · ${formatDateTimeIST(s.leaveWarehouseAt)}` : ''}
              </li>
            ))}
          </ul>
        ) : <p className="muted">{t('ck.noTasks')}</p>}
      </section>
      {can(auth, 'damage.report') ? (
        <section className="card">
          <h3>{t('ck.damageReports')}</h3>
          {reports.length ? (
            <table>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/approvals/damage/${r.id}`}>{r.number}</Link></td>
                    <td>{`${r.eventNumber} · ${r.itemName}`}</td>
                    <td>{`${t(`dmg.kind.${r.kind}` as MessageKey)} ${formatQuantity(r.quantity, null)}`}</td>
                    <td>{t(`dmg.status.${r.status}` as MessageKey)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">{t('ck.noReports')}</p>}
        </section>
      ) : null}
    </>
  );
}
