import Link from 'next/link';
import { t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import ChecklistTable from '@/components/checklist/ChecklistTable';
import { canPerform, loadStep } from '@/server/checklists/steps';

export const dynamic = 'force-dynamic';

export default async function StepPage({ params }: { params: { id: string; stepId: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.view')) return <Forbidden />;
  const step = await loadStep(auth, params.id, params.stepId).catch(() => null);
  if (!step) return <Forbidden />;
  const mine = await canPerform(auth, { event_id: step.eventId, step: step.step, warehouse_id: step.warehouseId });
  return (
    <>
      <section className="card">
        <p><Link href={`/events/${step.eventId}`}>{`${step.eventNumber} · ${step.eventName}`}</Link></p>
        <h2>{[t(`ck.step.${step.step}` as MessageKey), step.warehouseCode, step.round > 1 ? t('ck.round', { n: step.round }) : null].filter(Boolean).join(' · ')}</h2>
        <p>{t(`ck.stepStatus.${step.status}` as MessageKey)}</p>
      </section>
      <ChecklistTable step={step} canPerform={mine} />
    </>
  );
}
