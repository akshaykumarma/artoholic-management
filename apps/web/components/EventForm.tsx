'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, formatQuantity, t, type AvailabilityResult, type EventDetail } from '@artoholic/shared';
import { api } from '@/lib/api';
import MapPinPicker from '@/components/MapPinPicker';

type Opt = { id: string; label: string };
type Source = { kind: 'warehouse' | 'event'; id: string; qty: string };
type Line = { itemId: string; qty: string; sources: Source[] };
type Handover = { eventId: string; number: string; freeQty: string };

const IST = '+05:30';
/** datetime-local value (IST wall clock) ↔ ISO instant. */
const toIso = (v: string) => (v ? new Date(`${v}:00${IST}`).toISOString() : null);
const toLocal = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 16) : '');

export default function EventForm({ event, items, warehouses, eventManagers, storeManagers, types }: {
  event?: EventDetail; items: Opt[]; warehouses: Opt[]; eventManagers: Opt[]; storeManagers: Opt[]; types: Opt[];
}) {
  const router = useRouter();
  const [f, setF] = useState({
    name: event?.name ?? '', typeId: event?.typeId ?? '', description: event?.description ?? '',
    venueName: event?.venueName ?? '', venueAddress: event?.venueAddress ?? '',
    lat: event?.latitude == null ? '' : String(event.latitude), lng: event?.longitude == null ? '' : String(event.longitude),
    startsAt: toLocal(event?.startsAt ?? null), endsAt: toLocal(event?.endsAt ?? null), leaveWarehouseAt: toLocal(event?.leaveWarehouseAt ?? null),
    expectedReturnDate: event?.expectedReturnDate ?? '', siteContactName: event?.siteContactName ?? '', siteContactPhone: event?.siteContactPhone ?? '', notes: event?.notes ?? ''
  });
  const [ems, setEms] = useState<string[]>(event?.eventManagers.map((m) => m.id) ?? []);
  const [sms, setSms] = useState<string[]>(event?.storeManagers.map((m) => m.id) ?? []);
  const [lines, setLines] = useState<Line[]>(() => event?.lines.map((l) => ({
    itemId: l.itemId, qty: l.plannedQty.replace(/\.?0+$/, ''),
    sources: l.sources.map((s) => ({ kind: s.type, id: (s.type === 'warehouse' ? s.warehouseId : s.eventId) ?? '', qty: s.qty.replace(/\.?0+$/, '') }))
  })) ?? []);
  const [avail, setAvail] = useState<AvailabilityResult['lines']>([]);
  const [handovers, setHandovers] = useState<Record<string, Handover[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const leaveIso = toIso(f.leaveWarehouseAt);
  // Live availability for each warehouse source (US2-1, SC-002).
  const probe = useMemo(() => lines.flatMap((l) => l.sources.map((s) => (l.sources.length === 1 ? { ...s, qty: l.qty } : s))
    .filter((s) => s.kind === 'warehouse' && l.itemId && Number(s.qty) > 0)
    .map((s) => ({ itemId: l.itemId, qty: s.qty, warehouseId: s.id || undefined }))), [lines]);
  useEffect(() => {
    if (!leaveIso || !f.expectedReturnDate || !probe.length) { setAvail([]); return; }
    const h = setTimeout(() => {
      void api.post<AvailabilityResult>('/api/v1/events/availability', { eventId: event?.id, leaveWarehouseAt: leaveIso, expectedReturnDate: f.expectedReturnDate, lines: probe })
        .then((r) => setAvail(r.lines)).catch(() => setAvail([]));
    }, 300);
    return () => clearTimeout(h);
  }, [leaveIso, f.expectedReturnDate, probe, event?.id]);
  // Earlier events that can hand items over directly (clarification).
  const itemKey = lines.map((l) => l.itemId).join();
  useEffect(() => {
    if (!leaveIso) return;
    for (const itemId of new Set(lines.map((l) => l.itemId).filter(Boolean))) {
      const q = new URLSearchParams({ itemId, leaveAt: leaveIso, ...(event?.id ? { eventId: event.id } : {}) });
      void api.get<{ items: Handover[] }>(`/api/v1/events/handover-sources?${q.toString()}`)
        .then((r) => setHandovers((cur) => ({ ...cur, [itemId]: r.items }))).catch(() => undefined);
    }
  }, [leaveIso, itemKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const availFor = (itemId: string, s: Source) => avail.find((a) => a.itemId === itemId && (s.id ? a.warehouseId === s.id : true));
  const updLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const updSource = (i: number, k: number, patch: Partial<Source>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, sources: l.sources.map((s, m) => (m === k ? { ...s, ...patch } : s)) } : l)));

  function payload() {
    return {
      name: f.name, typeId: f.typeId || null, description: f.description, venueName: f.venueName, venueAddress: f.venueAddress,
      latitude: f.lat === '' ? null : Number(f.lat), longitude: f.lng === '' ? null : Number(f.lng),
      startsAt: toIso(f.startsAt), endsAt: toIso(f.endsAt), leaveWarehouseAt: leaveIso, expectedReturnDate: f.expectedReturnDate || null,
      siteContactName: f.siteContactName, siteContactPhone: f.siteContactPhone || null, notes: f.notes,
      eventManagerIds: ems, storeManagerIds: sms,
      lines: lines.filter((l) => l.itemId && Number(l.qty) > 0).map((l) => {
        const srcs = l.sources.length === 1 ? [{ ...l.sources[0]!, qty: l.qty }] : l.sources;
        return { itemId: l.itemId, plannedQty: l.qty, sources: srcs.filter((s) => s.id).map((s) => s.kind === 'warehouse'
          ? { type: 'warehouse' as const, warehouseId: s.id, qty: s.qty } : { type: 'event' as const, eventId: s.id, qty: s.qty }) };
      })
    };
  }

  async function save(schedule: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      let saved: EventDetail;
      if (event) {
        saved = await api.request<EventDetail>('PATCH', `/api/v1/events/${event.id}`, { body: payload(), headers: { 'if-match': String(event.version) } });
        if (schedule && saved.status === 'draft') saved = await api.post<EventDetail>(`/api/v1/events/${event.id}/schedule`, {});
      } else {
        saved = await api.post<EventDetail>('/api/v1/events', { ...payload(), schedule });
      }
      router.push(`/events/${saved.id}`);
      router.refresh();
    } catch (err) {
      const d = err instanceof ApiClientError ? err.details : undefined;
      const fields = d?.fields as Record<string, string> | undefined;
      const missing = d?.missing as string[] | undefined;
      setMsg(fields ? Object.values(fields).join(' · ') : missing ? `${err instanceof Error ? err.message : ''} (${missing.join(', ')})` : err instanceof Error ? err.message : t('error.INTERNAL'));
    } finally {
      setBusy(false);
    }
  }

  const people = (label: string, opts: Opt[], chosen: string[], setChosen: (v: string[]) => void) => (
    <fieldset>
      <legend>{label}</legend>
      {opts.map((o) => (
        <label key={o.id} style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={chosen.includes(o.id)} style={{ width: 20, minHeight: 20 }}
            onChange={() => setChosen(chosen.includes(o.id) ? chosen.filter((x) => x !== o.id) : [...chosen, o.id])} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );

  return (
    <form method="post" className="card" aria-label={event ? t('ev.edit') : t('ev.new')} onSubmit={(e) => { e.preventDefault(); void save(false); }}>
      <h2>{event ? `${t('ev.edit')} · ${event.number}` : t('ev.new')}</h2>
      <label htmlFor="f-name">{t('ev.name')}</label>
      <input id="f-name" value={f.name} onChange={set('name')} />
      <label htmlFor="f-type">{t('ev.type')}</label>
      <select id="f-type" value={f.typeId} onChange={set('typeId')}>
        <option value="">{t('ev.any')}</option>
        {types.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <label htmlFor="f-venue">{t('ev.venueName')}</label>
      <input id="f-venue" value={f.venueName} onChange={set('venueName')} />
      <label htmlFor="f-address">{t('ev.venueAddress')}</label>
      <input id="f-address" value={f.venueAddress} onChange={set('venueAddress')} />
      <MapPinPicker lat={f.lat} lng={f.lng} onChange={(lat, lng) => setF({ ...f, lat, lng })} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <div><label htmlFor="f-leave">{t('ev.leaveAt')}</label><input id="f-leave" type="datetime-local" value={f.leaveWarehouseAt} onChange={set('leaveWarehouseAt')} /></div>
        <div><label htmlFor="f-starts">{t('ev.starts')}</label><input id="f-starts" type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></div>
        <div><label htmlFor="f-ends">{t('ev.ends')}</label><input id="f-ends" type="datetime-local" value={f.endsAt} onChange={set('endsAt')} /></div>
        <div><label htmlFor="f-return">{t('ev.returnDate')}</label><input id="f-return" type="date" value={f.expectedReturnDate} onChange={set('expectedReturnDate')} /></div>
      </div>
      <label htmlFor="f-contact">{t('ev.siteContact')}</label>
      <input id="f-contact" value={f.siteContactName} onChange={set('siteContactName')} />
      <label htmlFor="f-phone">{t('ev.sitePhone')}</label>
      <input id="f-phone" value={f.siteContactPhone} onChange={set('siteContactPhone')} />
      <label htmlFor="f-desc">{t('ev.description')}</label>
      <textarea id="f-desc" value={f.description} onChange={set('description')} />
      <label htmlFor="f-notes">{t('ev.notes')}</label>
      <textarea id="f-notes" value={f.notes} onChange={set('notes')} />
      {people(t('ev.eventManagers'), eventManagers, ems, setEms)}
      {people(t('ev.storeManagers'), storeManagers, sms, setSms)}
      {event?.suggestedStoreManagers.length ? <p className="muted">{t('ev.suggested', { names: event.suggestedStoreManagers.map((s) => `${s.fullName} (${s.warehouseCode})`).join(', ') })}</p> : null}

      <h3>{t('ev.items')}</h3>
      {lines.map((l, i) => (
        <div key={i} className="card" style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ flex: 3, minWidth: 200 }}>
              <label htmlFor={`l-item-${i}`}>{t('ev.item')}</label>
              <select id={`l-item-${i}`} value={l.itemId} onChange={(e) => updLine(i, { itemId: e.target.value })}>
                <option value="" />
                {items.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 90 }}>
              <label htmlFor={`l-qty-${i}`}>{t('ev.qty')}</label>
              <input id={`l-qty-${i}`} inputMode="decimal" value={l.qty} onChange={(e) => updLine(i, { qty: e.target.value })} />
            </div>
            <button type="button" className="secondary" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>{t('ev.remove')}</button>
          </div>
          {l.sources.map((s, k) => {
            const a = s.kind === 'warehouse' ? availFor(l.itemId, l.sources.length === 1 ? { ...s, qty: l.qty } : s) : undefined;
            return (
              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                <div style={{ flex: 3, minWidth: 200 }}>
                  <label htmlFor={`l-src-${i}-${k}`}>{t('ev.source')}</label>
                  <select id={`l-src-${i}-${k}`} value={`${s.kind}:${s.id}`} onChange={(e) => {
                    const [kind, id] = e.target.value.split(':') as ['warehouse' | 'event', string];
                    updSource(i, k, { kind, id });
                  }}>
                    <option value="warehouse:" />
                    {warehouses.map((w) => <option key={w.id} value={`warehouse:${w.id}`}>{w.label}</option>)}
                    {(handovers[l.itemId] ?? []).map((h) => <option key={h.eventId} value={`event:${h.eventId}`}>{t('ev.fromEvent', { number: `${h.number} (${formatQuantity(h.freeQty, null)})` })}</option>)}
                  </select>
                </div>
                {l.sources.length > 1 ? (
                  <div style={{ flex: 1, minWidth: 90 }}>
                    <label htmlFor={`l-sqty-${i}-${k}`}>{t('ev.qty')}</label>
                    <input id={`l-sqty-${i}-${k}`} inputMode="decimal" value={s.qty} onChange={(e) => updSource(i, k, { qty: e.target.value })} />
                  </div>
                ) : null}
                {a ? (
                  <p data-testid={`avail-${i}-${k}`} className={Number(a.shortfall) > 0 ? 'error' : 'muted'} style={{ margin: 0, minHeight: 44, display: 'flex', alignItems: 'center' }}>
                    {Number(a.shortfall) > 0
                      ? t('ev.short', { available: formatQuantity(a.available, null), short: formatQuantity(a.shortfall, null) })
                      : t('ev.availability', { available: formatQuantity(a.available, null) })}
                  </p>
                ) : null}
              </div>
            );
          })}
          <button type="button" className="secondary" onClick={() => updLine(i, { sources: [...l.sources, { kind: 'warehouse', id: '', qty: '' }] })}>{t('ev.split')}</button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => setLines((ls) => [...ls, { itemId: '', qty: '', sources: [{ kind: 'warehouse', id: warehouses[0]?.id ?? '', qty: '' }] }])}>{t('ev.addLine')}</button>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {!event || event.status === 'draft' ? <button type="submit" className="secondary" disabled={busy}>{t('ev.saveDraft')}</button> : null}
        <button type="button" disabled={busy} onClick={() => void save(true)}>{event && event.status !== 'draft' ? t('ev.save') : t('ev.saveSchedule')}</button>
      </div>
      {msg ? <p role="alert" className="error">{msg}</p> : null}
    </form>
  );
}
