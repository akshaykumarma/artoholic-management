import Link from 'next/link';
import { formatDateTimeIST, formatPlainDate, formatQuantity, isEditable, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getEvent } from '@/server/events/events';
import EventActions from './EventActions';
import LiveEventPanel from './LiveEventPanel';
import { getRounds } from '@/server/checklists/steps';
import { getLineTotals } from '@/server/events/closure';
import { eventFormOptions } from '../load-options';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }: { params: { id: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.view')) return <Forbidden />;
  const e = await getEvent(auth, params.id).catch(() => null);
  if (!e) return <Forbidden />;
  const without = e.lines.filter((l) => e.linesWithoutStoreManager.includes(l.id)).map((l) => l.itemName);
  return (
    <>
      {e.warnings.length ? (
        <section className="card" role="alert" style={{ borderLeft: '6px solid #c0392b' }}>
          <strong>{t('ev.banner', { n: e.warnings.length })}</strong>
          <ul>
            {e.warnings.map((w) => (
              <li key={w.id}>
                {t('ev.warningLine', { item: w.itemName, source: w.warehouseCode ?? e.lines.flatMap((l) => l.sources).find((s) => s.eventId === w.sourceEventId)?.eventNumber ?? '', short: formatQuantity(w.shortfallQty, null) })}
                {w.clashingEvents.length ? ` · ${t('ev.clashes', { events: w.clashingEvents.map((c) => c.number).join(', ') })}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="card">
        <p><Link href="/events">{t('ev.title')}</Link></p>
        <h2>{`${e.name || e.number} · ${e.number}`}</h2>
        <p>{[t(`ev.status.${e.status}` as MessageKey), e.typeName].filter(Boolean).join(' · ')}</p>
        {e.cancelledReason ? <p>{t('ev.cancelled', { reason: e.cancelledReason })}</p> : null}
        <p>{[e.venueName, e.venueAddress].filter(Boolean).join(', ')}</p>
        <p>{[e.startsAt ? formatDateTimeIST(e.startsAt) : '', e.endsAt ? formatDateTimeIST(e.endsAt) : ''].filter(Boolean).join(' → ')}</p>
        {e.leaveWarehouseAt && e.expectedReturnDate ? <p>{t('ev.window', { leave: formatDateTimeIST(e.leaveWarehouseAt), ret: formatPlainDate(e.expectedReturnDate) })}</p> : null}
        <p>{`${t('ev.eventManagers')}: ${e.eventManagers.map((m) => m.fullName).join(', ')}`}</p>
        <p>{`${t('ev.storeManagers')}: ${e.storeManagers.map((m) => m.fullName).join(', ')}`}</p>
        {e.suggestedStoreManagers.length ? <p className="muted">{t('ev.suggested', { names: e.suggestedStoreManagers.map((s) => `${s.fullName} (${s.warehouseCode})`).join(', ') })}</p> : null}
        {without.length && e.status !== 'cancelled' ? <p className="error">{t('ev.noStoreManager', { items: without.join(', ') })}</p> : null}
        {e.siteContactName ? <p>{`${t('ev.siteContact')}: ${e.siteContactName} ${e.siteContactPhone ?? ''}`}</p> : null}
        {e.notes ? <p>{e.notes}</p> : null}
        {e.clashWarnings.map((c, i) => (
          <p key={i} className="error">{t('ev.clashedBy', { event: c.eventNumber, item: c.itemName, short: formatQuantity(c.shortfallQty, null) })}</p>
        ))}
      </section>
      <section className="card">
        <h3>{t('ev.items')}</h3>
        <table>
          <thead><tr><th>{t('ev.item')}</th><th>{t('ev.qty')}</th><th>{t('ev.source')}</th></tr></thead>
          <tbody>
            {e.lines.map((l) => (
              <tr key={l.id}>
                <td>{`${l.itemCode} · ${l.itemName}`}</td>
                <td>{formatQuantity(l.plannedQty, l.unitCode)}</td>
                <td>{l.sources.map((s) => s.type === 'warehouse'
                  ? `${s.warehouseCode} ${formatQuantity(s.qty, l.unitCode)} (${t('ev.reserved', { n: formatQuantity(s.reservedQty, l.unitCode) })})`
                  : `${t('ev.fromEvent', { number: s.eventNumber ?? '' })} ${formatQuantity(s.qty, l.unitCode)}`).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {e.status !== 'draft' && e.status !== 'cancelled' ? await (async () => {
        const isAdmin = can(auth, 'events.manage');
        const opts = isAdmin ? await eventFormOptions() : { items: [], warehouses: [] };
        return <LiveEventPanel eventId={e.id} rounds={await getRounds(auth, e.id)} totals={await getLineTotals(auth, e.id)} isAdmin={isAdmin} items={opts.items} warehouses={opts.warehouses} />;
      })() : null}
      {can(auth, 'events.manage') ? <EventActions id={e.id} status={e.status} editable={isEditable(e.status)} /> : null}
    </>
  );
}
