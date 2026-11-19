'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { ApiClientError, formatDateTimeIST, formatQuantity, SHORT_REASONS, t, type EntryInput, type MessageKey, type Step, type StepRow } from '@artoholic/shared';
import { api } from '@/lib/api';

type Draft = Record<string, EntryInput>;
const DRAFT_PREFIX = 'artoholic:checklist:';
const n = (v: string | null | undefined) => new Decimal(v && /^\d+(\.\d+)?$/.test(v) ? v : 0);
const trim = (v: string | null) => (v === null ? '' : v.replace(/\.?0+$/, '') || '0');

function fromRow(r: StepRow): EntryInput {
  return {
    entryId: r.entryId, done: r.done, dispatched: trim(r.dispatched) || undefined, received: trim(r.received) || undefined, returned: trim(r.returned) || undefined,
    handedOver: trim(r.handedOver) || undefined, handoverEventId: r.handoverEventId, consumed: trim(r.consumed) || undefined, damaged: trim(r.damaged) || undefined,
    remainingLength: r.remainingLength ? trim(r.remainingLength) : null, shortReason: r.shortReason, note: r.note, binLocationId: r.binLocationId,
    pieceId: r.pieceId, photoKeys: r.photoKeys
  };
}

/** Shrinks a photo so its longest side is ≤ 1600 px (JPEG 0.8) before upload (FR-012). */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.8));
}

export default function ChecklistTable({ step, canPerform }: { step: Step; canPerform: boolean }) {
  const router = useRouter();
  const key = `${DRAFT_PREFIX}${step.id}`;
  const locked = step.status === 'submitted' || !canPerform || !step.ready;
  const [entries, setEntries] = useState<Draft>(() => Object.fromEntries(step.rows.map((r) => [r.entryId, fromRow(r)])));
  const [restored, setRestored] = useState(false);
  const [q, setQ] = useState('');
  const [notDone, setNotDone] = useState(false);
  const [transport, setTransport] = useState({ vehicleNumber: step.transport.vehicleNumber ?? '', driverName: step.transport.driverName ?? '', driverPhone: step.transport.driverPhone ?? '' });
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Entries survive reloads, lost signal and session expiry on this device (FR-014).
  useEffect(() => {
    if (locked) return;
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) {
        setEntries((cur) => ({ ...cur, ...(JSON.parse(saved) as Draft) }));
        setRestored(true);
      }
    } catch { /* storage unavailable */ }
  }, [key, locked]);
  const update = (id: string, patch: Partial<EntryInput>) => setEntries((cur) => {
    const next = { ...cur, [id]: { ...cur[id]!, ...patch } };
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const missingOf = (r: StepRow, e: EntryInput) => {
    if (step.step === 'warehouse_dispatch') return new Decimal(0);
    const used = step.step === 'return_dispatch' ? n(e.returned).plus(n(e.handedOver)).plus(n(e.consumed)).plus(n(e.damaged)) : n(e.received).plus(n(e.damaged));
    return Decimal.max(new Decimal(r.expected).minus(used), 0);
  };
  const visible = useMemo(() => step.rows.filter((r) => (!q || `${r.itemCode} ${r.itemName} ${r.usualBin ?? ''}`.toLowerCase().includes(q.toLowerCase())) && (!notDone || !entries[r.entryId]?.done)), [step.rows, q, notDone, entries]);
  const missingLines = step.rows.map((r) => ({ r, m: missingOf(r, entries[r.entryId]!) })).filter((x) => x.m.gt(0));

  async function addPhoto(id: string, file: File | undefined) {
    if (!file) return;
    try {
      const { url, key: photoKey } = await api.post<{ url: string; key: string }>('/api/v1/photos/upload-url', { purpose: 'damage', contentType: 'image/jpeg' });
      const put = await fetch(url, { method: 'PUT', body: await compress(file), headers: { 'content-type': 'image/jpeg' } });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      update(id, { photoKeys: [...(entries[id]?.photoKeys ?? []), photoKey] });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true });
    }
  }

  const payload = () => Object.values(entries);
  async function saveProgress() {
    setBusy(true);
    try {
      await api.put(`/api/v1/events/${step.eventId}/steps/${step.id}/progress`, { entries: payload() });
      setMsg({ text: t('ck.saved') });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    const location = await new Promise<{ latitude: number; longitude: number } | undefined>((resolve) => {
      if (!('geolocation' in navigator)) return resolve(undefined);
      navigator.geolocation.getCurrentPosition((p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => resolve(undefined), { timeout: 3000 });
    });
    try {
      await api.post(`/api/v1/events/${step.eventId}/steps/${step.id}/submit`, {
        version: step.version, entries: payload(), confirmMissing: confirm, location, deviceLabel: navigator.userAgent.slice(0, 80),
        ...(step.step === 'warehouse_dispatch' ? { transport: { vehicleNumber: transport.vehicleNumber || undefined, driverName: transport.driverName || undefined, driverPhone: transport.driverPhone || undefined } } : {})
      });
      try { window.localStorage.removeItem(key); } catch { /* ignore */ }
      router.refresh();
    } catch (err) {
      const d = err instanceof ApiClientError ? err.details : undefined;
      const fields = d?.fields as Record<string, string> | undefined;
      setMsg({ text: fields ? Object.values(fields).join(' · ') : err instanceof Error ? err.message : t('error.INTERNAL'), error: true });
    } finally {
      setBusy(false);
    }
  }

  const num = (r: StepRow, field: 'dispatched' | 'received' | 'returned' | 'handedOver' | 'consumed' | 'damaged' | 'remainingLength', label: string) => (
    <input aria-label={`${label} · ${r.itemName}`} inputMode="decimal" disabled={locked} style={{ width: 90 }}
      value={(entries[r.entryId]?.[field] as string | null | undefined) ?? ''} onChange={(e) => update(r.entryId, { [field]: e.target.value || undefined })} />
  );
  const isDispatch = step.step === 'warehouse_dispatch';
  const isReturn = step.step === 'return_dispatch';
  const isReceipt = step.step === 'site_receipt' || step.step === 'warehouse_receipt';

  return (
    <section className="card">
      {step.submittedAt ? <p role="status">{t('ck.submitted', { who: step.submittedBy ?? '', when: formatDateTimeIST(step.submittedAt) })}</p> : null}
      {!step.ready && step.status !== 'submitted' ? <p className="muted">{t('ck.notReady')}</p> : null}
      {restored && !locked ? <p className="muted">{t('ck.restored')}</p> : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="ck-q">{t('ck.searchLines')}</label>
          <input id="ck-q" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
          <input type="checkbox" checked={notDone} onChange={(e) => setNotDone(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
          {t('ck.notDoneOnly')}
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('ck.done')}</th><th>{t('ck.item')}</th><th>{isDispatch ? t('ck.planned') : t('ck.expected')}</th>
              {isDispatch ? <><th>{t('ck.dispatched')}</th><th>{t('ck.reason')}</th></> : null}
              {isReceipt ? <><th>{t('ck.received')}</th><th>{t('ck.damaged')}</th></> : null}
              {isReturn ? <><th>{t('ck.returned')}</th><th>{t('ck.handedOver')}</th><th>{t('ck.consumed')}</th><th>{t('ck.damaged')}</th></> : null}
              {!isDispatch ? <th>{t('ck.missing')}</th> : null}
              {step.step === 'warehouse_receipt' ? <th>{t('ck.bin')}</th> : null}
              <th>{t('ck.note')}</th>
              {!isDispatch ? <th>{t('ck.photos')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const e = entries[r.entryId]!;
              const short = isDispatch && n(e.dispatched).lt(r.expected);
              return (
                <tr key={r.entryId}>
                  <td><input type="checkbox" aria-label={`${t('ck.done')} · ${r.itemName}`} disabled={locked} checked={!!e.done} onChange={(x) => update(r.entryId, { done: x.target.checked })} style={{ width: 20, minHeight: 20 }} /></td>
                  <td>
                    {`${r.itemCode} · ${r.itemName}`}
                    <div className="muted">{[r.usualBin, r.sourceLabel].filter(Boolean).join(' · ')}</div>
                    {r.pieceOptions.length ? (
                      <select aria-label={`${t('ck.piece')} · ${r.itemName}`} disabled={locked} value={e.pieceId ?? ''} onChange={(x) => update(r.entryId, { pieceId: x.target.value || null })}>
                        <option value="">{t('ck.piece')}</option>
                        {r.pieceOptions.map((p) => <option key={p.id} value={p.id}>{`${p.number} (${formatQuantity(p.length, r.unitCode)})`}</option>)}
                      </select>
                    ) : null}
                  </td>
                  <td>{formatQuantity(r.expected, r.unitCode)}</td>
                  {isDispatch ? (
                    <>
                      <td>{num(r, 'dispatched', t('ck.dispatched'))}</td>
                      <td>{short ? (
                        <select aria-label={`${t('ck.reason')} · ${r.itemName}`} disabled={locked} value={e.shortReason ?? ''} onChange={(x) => update(r.entryId, { shortReason: (x.target.value || null) as EntryInput['shortReason'] })}>
                          <option value="" />
                          {SHORT_REASONS.map((s) => <option key={s} value={s}>{t(`ck.reason.${s}` as MessageKey)}</option>)}
                        </select>
                      ) : null}</td>
                    </>
                  ) : null}
                  {isReceipt ? <><td>{num(r, 'received', t('ck.received'))}</td><td>{num(r, 'damaged', t('ck.damaged'))}</td></> : null}
                  {isReturn ? (
                    <>
                      <td>{num(r, 'returned', t('ck.returned'))}</td>
                      <td>{r.handoverOptions.length ? (
                        <>
                          {num(r, 'handedOver', t('ck.handedOver'))}
                          <select aria-label={`${t('ck.handoverTo')} · ${r.itemName}`} disabled={locked} value={e.handoverEventId ?? ''} onChange={(x) => update(r.entryId, { handoverEventId: x.target.value || null })}>
                            <option value="" />
                            {r.handoverOptions.map((o) => <option key={o.eventId} value={o.eventId}>{o.number}</option>)}
                          </select>
                        </>
                      ) : null}</td>
                      <td>{r.trackingType === 'counted' ? null : num(r, 'consumed', t('ck.consumed'))}{r.trackingType === 'cut' ? num(r, 'remainingLength', t('ck.remaining')) : null}</td>
                      <td>{num(r, 'damaged', t('ck.damaged'))}</td>
                    </>
                  ) : null}
                  {!isDispatch ? <td>{formatQuantity(missingOf(r, e).toFixed(3), r.unitCode)}</td> : null}
                  {step.step === 'warehouse_receipt' ? (
                    <td>
                      <select aria-label={`${t('ck.bin')} · ${r.itemName}`} disabled={locked} value={e.binLocationId ?? ''} onChange={(x) => update(r.entryId, { binLocationId: x.target.value || null })}>
                        <option value="" />
                        {step.bins.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
                      </select>
                    </td>
                  ) : null}
                  <td><input aria-label={`${t('ck.note')} · ${r.itemName}`} disabled={locked} value={e.note ?? ''} onChange={(x) => update(r.entryId, { note: x.target.value })} /></td>
                  {!isDispatch ? (
                    <td>
                      <span className="muted">{t('ck.photoCount', { n: e.photoKeys?.length ?? 0 })}</span>
                      {!locked ? <input type="file" accept="image/*" capture="environment" aria-label={`${t('ck.addPhoto')} · ${r.itemName}`} onChange={(x) => void addPhoto(r.entryId, x.target.files?.[0])} /> : null}
                      {r.recheckReportId ? <Recheck reportId={r.recheckReportId} itemName={r.itemName} /> : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!locked && isDispatch ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          <div><label htmlFor="ck-vehicle">{t('ck.vehicle')}</label><input id="ck-vehicle" value={transport.vehicleNumber} onChange={(e) => setTransport({ ...transport, vehicleNumber: e.target.value })} /></div>
          <div><label htmlFor="ck-driver">{t('ck.driver')}</label><input id="ck-driver" value={transport.driverName} onChange={(e) => setTransport({ ...transport, driverName: e.target.value })} /></div>
          <div><label htmlFor="ck-phone">{t('ck.driverPhone')}</label><input id="ck-phone" value={transport.driverPhone} onChange={(e) => setTransport({ ...transport, driverPhone: e.target.value })} /></div>
        </div>
      ) : null}
      {!locked && missingLines.length ? (
        <div role="group" aria-label={t('ck.confirmMissing')}>
          <ul>{missingLines.map(({ r, m }) => <li key={r.entryId}>{t('ck.missingLine', { item: r.itemName, n: formatQuantity(m.toFixed(3), r.unitCode) })}</li>)}</ul>
          <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
            {t('ck.confirmMissing')}
          </label>
        </div>
      ) : null}
      {!locked ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="secondary" disabled={busy} onClick={() => void saveProgress()}>{t('ck.saveProgress')}</button>
          <button type="button" disabled={busy} onClick={() => void submit()}>{t('ck.submit')}</button>
        </div>
      ) : null}
      {msg ? <p role={msg.error ? 'alert' : 'status'} className={msg.error ? 'error' : undefined}>{msg.text}</p> : null}
    </section>
  );
}

function Recheck({ reportId, itemName }: { reportId: string; itemName: string }) {
  const router = useRouter();
  const [qty, setQty] = useState('0');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card" style={{ padding: 8 }}>
      <p className="error">{t('ck.recheck')}</p>
      <input aria-label={`${t('ck.damaged')} · ${itemName}`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 90 }} />
      <input aria-label={`${t('ck.note')} · ${itemName}`} value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="secondary" onClick={() => api.post(`/api/v1/damage-reports/${reportId}/recheck`, { damaged: qty, missing: qty, note })
        .then(() => router.refresh()).catch((e: unknown) => setErr(e instanceof Error ? e.message : t('error.INTERNAL')))}>{t('ck.recheckSubmit')}</button>
      {err ? <p role="alert" className="error">{err}</p> : null}
    </div>
  );
}
