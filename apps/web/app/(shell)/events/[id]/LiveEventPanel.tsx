'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ApiClientError, formatQuantity, t, type LineTotalsRow, type MessageKey, type Rounds } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

type Opt = { id: string; label: string };

/** Checklist steps, reconciliation, close, corrections and new rounds on the event page (006). */
export default function LiveEventPanel({ eventId, rounds, totals, isAdmin, items, warehouses }: {
  eventId: string; rounds: Rounds; totals: LineTotalsRow[]; isAdmin: boolean; items: Opt[]; warehouses: Opt[];
}) {
  const [corr, setCorr] = useState({ lineSourceId: totals[0]?.sourceId ?? '', field: 'returned', newValue: '', reason: '' });
  const [round, setRound] = useState({ itemId: items[0]?.id ?? '', warehouseId: warehouses[0]?.id ?? '', plannedQty: '' });
  const live = ['dispatching', 'in_transit', 'at_site'].includes(rounds.status);
  const closable = !['draft', 'scheduled', 'cancelled', 'closed'].includes(rounds.status);
  return (
    <>
      <section className="card">
        <h3>{t('ck.checklists')}</h3>
        {rounds.rounds.map((r) => (
          <div key={r.id}>
            {rounds.rounds.length > 1 ? <h4>{t('ck.round', { n: r.round })}</h4> : null}
            <ul>
              {r.steps.map((s) => (
                <li key={s.id}>
                  <Link href={`/events/${eventId}/checklists/${s.id}`}>{[t(`ck.step.${s.step}` as MessageKey), s.warehouseCode].filter(Boolean).join(' · ')}</Link>
                  {` · ${t(`ck.stepStatus.${s.status}` as MessageKey)}`}{!s.ready && s.status !== 'submitted' ? ` · ${t('ck.notReady')}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p><Link href={`/events/${eventId}/activity`}>{t('ck.activity')}</Link></p>
      </section>
      {totals.length && rounds.status !== 'scheduled' ? (
        <section className="card">
          <h3>{t('ck.totals')}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>{t('ck.item')}</th><th>{t('ck.dispatched')}</th><th>{t('ck.returned')}</th><th>{t('ck.handedOver')}</th><th>{t('ck.consumed')}</th><th>{t('ck.damaged')}</th><th>{t('ck.missing')}</th><th>{t('ck.outstanding')}</th></tr></thead>
              <tbody>
                {totals.map((l) => (
                  <tr key={l.sourceId}>
                    <td>{`${l.itemName} · ${l.sourceLabel}`}</td>
                    <td>{formatQuantity(l.dispatched, null)}</td><td>{formatQuantity(l.returned, null)}</td><td>{formatQuantity(l.handedOver, null)}</td>
                    <td>{formatQuantity(l.consumed, null)}</td><td>{formatQuantity(l.damagedApproved, null)}</td><td>{formatQuantity(l.lostApproved, null)}</td>
                    <td className={l.reconciled ? undefined : 'error'}>{l.reconciled ? t('ck.reconciled') : formatQuantity(l.outstanding, null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {isAdmin && closable ? (
        <ActionForm submit={t('ck.close')} success={t('ck.closed')} onSubmit={async () => {
          try {
            await api.post(`/api/v1/events/${eventId}/close`, {});
          } catch (e) {
            if (e instanceof ApiClientError && e.code === 'NOT_RECONCILED') {
              const d = e.details as { lines: Array<{ item: string; outstanding: string }>; reports: Array<{ number: string }> };
              throw new Error([d.lines.length ? t('ck.blockedLines', { lines: d.lines.map((l) => `${l.item} (${l.outstanding})`).join(', ') }) : '',
                d.reports.length ? t('ck.blockedReports', { reports: d.reports.map((r) => r.number).join(', ') }) : ''].filter(Boolean).join(' · ') || e.message);
            }
            throw e;
          }
        }}><span /></ActionForm>
      ) : null}
      {isAdmin && rounds.status !== 'scheduled' && totals.length ? (
        <ActionForm title={t('ck.correct')} submit={t('ck.correct')} onSubmit={() => api.post(`/api/v1/events/${eventId}/corrections`, corr).then(() => undefined)}>
          <label htmlFor="corr-line">{t('ck.line')}</label>
          <select id="corr-line" value={corr.lineSourceId} onChange={(e) => setCorr({ ...corr, lineSourceId: e.target.value })}>
            {totals.map((l) => <option key={l.sourceId} value={l.sourceId}>{`${l.itemName} · ${l.sourceLabel}`}</option>)}
          </select>
          <label htmlFor="corr-field">{t('ck.field')}</label>
          <select id="corr-field" value={corr.field} onChange={(e) => setCorr({ ...corr, field: e.target.value })}>
            {(['returned', 'consumed', 'lost', 'damaged'] as const).map((f) => <option key={f} value={f}>{t(`ck.field.${f}`)}</option>)}
          </select>
          <label htmlFor="corr-value">{t('ck.newValue')}</label>
          <input id="corr-value" inputMode="decimal" value={corr.newValue} onChange={(e) => setCorr({ ...corr, newValue: e.target.value })} />
          <label htmlFor="corr-reason">{t('ck.correctReason')}</label>
          <input id="corr-reason" value={corr.reason} onChange={(e) => setCorr({ ...corr, reason: e.target.value })} />
        </ActionForm>
      ) : null}
      {isAdmin && live ? (
        <ActionForm title={t('ck.addRound')} submit={t('ev.addLine')} onSubmit={async () => {
          const r = await api.post<{ round: number }>(`/api/v1/events/${eventId}/rounds`, { lines: [round] });
          return t('ck.roundAdded', { n: r.round });
        }}>
          <label htmlFor="round-item">{t('ev.item')}</label>
          <select id="round-item" value={round.itemId} onChange={(e) => setRound({ ...round, itemId: e.target.value })}>{items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
          <label htmlFor="round-wh">{t('ev.source')}</label>
          <select id="round-wh" value={round.warehouseId} onChange={(e) => setRound({ ...round, warehouseId: e.target.value })}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
          <label htmlFor="round-qty">{t('ev.qty')}</label>
          <input id="round-qty" inputMode="decimal" value={round.plannedQty} onChange={(e) => setRound({ ...round, plannedQty: e.target.value })} />
        </ActionForm>
      ) : null}
    </>
  );
}
