import Link from 'next/link';
import { formatDateTimeIST, formatQuantity, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getReport } from '@/server/damage/reports';
import DamageDecision from './DamageDecision';

export const dynamic = 'force-dynamic';

export default async function DamagePage({ params }: { params: { id: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'damage.report')) return <Forbidden />;
  const r = await getReport(auth, params.id).catch(() => null);
  if (!r) return <Forbidden />;
  return (
    <section className="card">
      <p><Link href="/approvals">{t('ck.title')}</Link></p>
      <h2>{t('dmg.title', { number: r.number })}</h2>
      <p><Link href={`/events/${r.eventId}`}>{`${r.eventNumber} · ${r.eventName}`}</Link></p>
      <p><strong>{`${t(`dmg.kind.${r.kind}` as MessageKey)}: ${formatQuantity(r.quantity, null)} · ${r.itemName}`}</strong></p>
      <p>{`${t(`ck.step.${r.step}` as MessageKey)} · ${t('dmg.reportedBy', { who: r.reportedBy, when: formatDateTimeIST(r.reportedAt) })}`}</p>
      {r.latitude !== null && r.longitude !== null ? <p><a href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">{t('dmg.where')}</a></p> : null}
      {r.note ? <p>{r.note}</p> : null}
      {r.photosDeleted ? <p className="muted">{t('dmg.photosDeleted')}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {r.photos.map((p) => (
          // Presigned storage URLs change on every load, so next/image cannot cache them.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt={r.itemName} style={{ maxWidth: 240, borderRadius: 8 }} />
        ))}
      </div>
      <p>{t(`dmg.status.${r.status}` as MessageKey)}{r.decidedBy && r.decidedAt ? ` · ${t('dmg.decidedBy', { who: r.decidedBy, when: formatDateTimeIST(r.decidedAt) })}` : ''}{r.decisionComment ? ` · ${r.decisionComment}` : ''}</p>
      {r.status === 'pending' && can(auth, 'damage.approve') ? <DamageDecision id={r.id} /> : null}
    </section>
  );
}
