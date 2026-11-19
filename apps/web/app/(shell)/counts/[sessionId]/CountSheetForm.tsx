'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, formatQuantity, t, type CountSheet, type MessageKey } from '@artoholic/shared';
import { api } from '@/lib/api';

type Entry = { countedQty: string; note: string };

/** Web count sheet in bin order; entries kept in this browser until saved (FR-009). */
export default function CountSheetForm({ sheet, items }: { sheet: CountSheet; items: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const key = `artoholic:count:${sheet.id}`;
  const editable = (decision: string | null) => sheet.canCount && (decision === null || decision === 'recount');
  const [entries, setEntries] = useState<Record<string, Entry>>(() => Object.fromEntries(sheet.lines.map((l) => [l.id, { countedQty: l.countedQty?.replace(/\.?0+$/, '') ?? (l.countedQty === '0.000' ? '0' : ''), note: l.note }])));
  const [restored, setRestored] = useState(false);
  const [found, setFound] = useState({ itemId: items[0]?.id ?? '', locationId: sheet.locations[0]?.id ?? '', countedQty: '' });
  const [confirmZero, setConfirmZero] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (!sheet.canCount) return;
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) { setEntries((cur) => ({ ...cur, ...(JSON.parse(saved) as Record<string, Entry>) })); setRestored(true); }
    } catch { /* storage unavailable */ }
  }, [key, sheet.canCount]);
  const update = (id: string, patch: Partial<Entry>) => setEntries((cur) => {
    const next = { ...cur, [id]: { ...cur[id]!, ...patch } };
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const payload = () => sheet.lines.filter((l) => editable(l.decision)).map((l) => ({ lineId: l.id, countedQty: entries[l.id]!.countedQty === '' ? null : entries[l.id]!.countedQty, note: entries[l.id]!.note }));
  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: ok });
      router.refresh();
    } catch (e) {
      const fields = e instanceof ApiClientError ? (e.details?.fields as Record<string, string> | undefined) : undefined;
      setMsg({ text: fields ? Object.values(fields).join(' · ') : e instanceof Error ? e.message : t('error.INTERNAL'), error: true });
    }
  }
  const save = () => api.put(`/api/v1/counts/sessions/${sheet.id}/entries`, { entries: payload() });
  return (
    <section className="card">
      {restored ? <p className="muted">{t('cnt.restored')}</p> : null}
      <table>
        <thead><tr><th>{t('cnt.bin')}</th><th>{t('cnt.item')}</th><th>{t('cnt.condition')}</th>{sheet.lines[0]?.recordedQty !== undefined ? <th>{t('cnt.recorded')}</th> : null}<th>{t('cnt.counted')}</th><th>{t('ck.note')}</th></tr></thead>
        <tbody>
          {sheet.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.locationCode}</td>
              <td>
                {`${l.itemCode} · ${l.itemName}${l.pieceNumber ? ` · ${l.pieceNumber}` : ''}`}
                {l.eventMovement ? <div className="error">{t('cnt.eventMovement')}</div> : null}
                {l.addedByCounter ? <div className="muted">{t('cnt.added')}</div> : null}
                {l.decision && l.decision !== 'recount' ? <div className="muted">{t(`cnt.decision.${l.decision}` as MessageKey)}</div> : null}
              </td>
              <td>{t(`inv.condition.${l.condition}` as MessageKey)}</td>
              {l.recordedQty !== undefined ? <td>{formatQuantity(l.recordedQty, l.unitCode)}</td> : null}
              <td><input aria-label={`${t('cnt.counted')} · ${l.locationCode} · ${l.itemName}`} inputMode="decimal" style={{ width: 90 }} disabled={!editable(l.decision)}
                value={entries[l.id]?.countedQty ?? ''} onChange={(e) => update(l.id, { countedQty: e.target.value })} /></td>
              <td><input aria-label={`${t('ck.note')} · ${l.itemName}`} disabled={!editable(l.decision)} value={entries[l.id]?.note ?? ''} onChange={(e) => update(l.id, { note: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {sheet.canCount ? (
        <>
          <fieldset>
            <legend>{t('cnt.addLine')}</legend>
            <select aria-label={t('cnt.item')} value={found.itemId} onChange={(e) => setFound({ ...found, itemId: e.target.value })}>{items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
            <select aria-label={t('cnt.bin')} value={found.locationId} onChange={(e) => setFound({ ...found, locationId: e.target.value })}>{sheet.locations.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
            <input aria-label={t('cnt.counted')} inputMode="decimal" value={found.countedQty} onChange={(e) => setFound({ ...found, countedQty: e.target.value })} style={{ width: 90 }} />
            <button type="button" className="secondary" onClick={() => void run(() => api.put(`/api/v1/counts/sessions/${sheet.id}/entries`, { entries: [found] }), t('cnt.saved'))}>{t('cnt.addLine')}</button>
          </fieldset>
          <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={confirmZero} onChange={(e) => setConfirmZero(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
            {t('cnt.confirmZero')}
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="secondary" onClick={() => void run(save, t('cnt.saved'))}>{t('cnt.save')}</button>
            <button type="button" onClick={() => void run(async () => {
              await save();
              await api.post(`/api/v1/counts/sessions/${sheet.id}/submit`, { confirmZero });
              try { window.localStorage.removeItem(key); } catch { /* ignore */ }
            }, t('cnt.status.submitted'))}>{t('cnt.submit')}</button>
          </div>
        </>
      ) : null}
      {msg ? <p role={msg.error ? 'alert' : 'status'} className={msg.error ? 'error' : undefined}>{msg.text}</p> : null}
    </section>
  );
}
