import Link from 'next/link';
import { formatMoney, formatQuantity, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getReview } from '@/server/counts/sheet';
import LineDecision from './LineDecision';

export const dynamic = 'force-dynamic';

/** Variances sorted by ₹ impact; zero-variance lines are matched and need nothing (US4). */
export default async function ReviewPage({ params }: { params: { sessionId: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'counts.schedule')) return <Forbidden />;
  const r = await getReview(auth, params.sessionId).catch(() => null);
  if (!r) return <Forbidden />;
  return (
    <section className="card">
      <p><Link href={`/counts/${r.id}`}>{t('cnt.sheet')}</Link></p>
      <h2>{`${t('cnt.review')} · ${r.number}`}</h2>
      <p>{[t(`cnt.status.${r.status}` as MessageKey), t('cnt.totalVariance', { value: formatMoney(r.totalVariancePaise) })].join(' · ')}</p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>{t('cnt.bin')}</th><th>{t('cnt.item')}</th><th>{t('cnt.recorded')}</th><th>{t('cnt.counted')}</th><th>{t('cnt.variance')}</th><th>{t('cnt.value')}</th><th>{t('ev.status')}</th></tr></thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.locationCode}</td>
                <td>{`${l.itemName}${l.pieceNumber ? ` · ${l.pieceNumber}` : ''}`}{l.note ? <div className="muted">{l.note}</div> : null}</td>
                <td>{formatQuantity(l.recordedQty, l.unitCode)}</td>
                <td>{l.countedQty === null ? '' : formatQuantity(l.countedQty, l.unitCode)}</td>
                <td>{l.varianceQty}</td>
                <td>{formatMoney(l.variancePaise)}</td>
                <td>{l.decision === 'pending' ? <LineDecision lineId={l.id} /> : `${l.decision ? t(`cnt.decision.${l.decision}` as MessageKey) : ''}${l.decisionReason ? ` · ${l.decisionReason}` : ''}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
