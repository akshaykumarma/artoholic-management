import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ApiClientError, eventListSchema, eventSchema, todaySchema, type TodayView, formatDateTimeIST, formatPlainDate, formatQuantity, t, type EventDetail, type EventRow, type MessageKey } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, Message, ui } from './ui';

const errText = (err: unknown) => (err instanceof ApiClientError || err instanceof Error ? err.message : t('error.INTERNAL'));

function Row({ e, onOpen }: { e: EventRow; onOpen: (id: string) => void }) {
  return (
    <Pressable accessibilityRole="button" style={ui.row} onPress={() => onOpen(e.id)}>
      <Text style={{ fontWeight: '600' }}>{e.overbooked ? `⚠ ${e.name || e.number}` : e.name || e.number}</Text>
      <Text style={ui.muted}>{[e.number, t(`ev.status.${e.status}` as MessageKey), e.startsAt ? formatDateTimeIST(e.startsAt) : ''].filter(Boolean).join(' · ')}</Text>
    </Pressable>
  );
}

/** Dispatches and returns due today (005 US5-1). */
export function TodayScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { api } = useAuth();
  const [d, setD] = useState<TodayView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void api.get('/api/v1/events/today', todaySchema).then(setD).catch((e) => setErr(errText(e)));
  }, [api]);
  if (err) return <Message error>{err}</Message>;
  if (!d) return null;
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{`${t('ev.today')} · ${formatPlainDate(d.date)}`}</Text>
      <Text style={{ fontWeight: '600', marginTop: 8 }}>{t('ev.dispatches')}</Text>
      {d.dispatches.length ? d.dispatches.map((e) => <Row key={e.id} e={e} onOpen={onOpen} />) : <Text style={ui.muted}>{t('ev.none')}</Text>}
      <Text style={{ fontWeight: '600', marginTop: 8 }}>{t('ev.returns')}</Text>
      {d.returns.length ? d.returns.map((e) => <Row key={e.id} e={e} onOpen={onOpen} />) : <Text style={ui.muted}>{t('ev.none')}</Text>}
    </ScrollView>
  );
}

export function EventListScreen({ onOpen, onToday }: { onOpen: (id: string) => void; onToday: () => void }) {
  const { api } = useAuth();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EventRow[]>([]);
  useEffect(() => {
    const h = setTimeout(() => {
      void api.get(`/api/v1/events?q=${encodeURIComponent(q)}`, eventListSchema).then((r) => setItems(r.items)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(h);
  }, [api, q]);
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('ev.title')}</Text>
      <Button label={t('ev.today')} secondary onPress={onToday} />
      <Field label={t('ev.search')} value={q} onChangeText={setQ} />
      {items.map((e) => <Row key={e.id} e={e} onOpen={onOpen} />)}
    </ScrollView>
  );
}

/** Read-only event on the phone; planning happens on the web (005 FR-013). */
export function EventScreen({ id }: { id: string }) {
  const { api } = useAuth();
  const [e, setE] = useState<EventDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void api.get(`/api/v1/events/${id}`, eventSchema).then(setE).catch((x) => setErr(errText(x)));
  }, [api, id]);
  if (err) return <Message error>{err}</Message>;
  if (!e) return null;
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      {e.warnings.length ? (
        <View accessibilityRole="alert" style={{ backgroundColor: '#fdecea', padding: 12, borderRadius: 8, marginBottom: 8 }}>
          <Text style={{ fontWeight: '600', color: '#a52714' }}>{t('ev.banner', { n: e.warnings.length })}</Text>
          {e.warnings.map((w) => (
            <Text key={w.id} style={{ color: '#a52714' }}>{t('ev.warningLine', { item: w.itemName, source: w.warehouseCode ?? '', short: formatQuantity(w.shortfallQty, null) })}</Text>
          ))}
        </View>
      ) : null}
      <Text style={ui.title}>{e.name || e.number}</Text>
      <Text style={ui.muted}>{`${e.number} · ${t(`ev.status.${e.status}` as MessageKey)}`}</Text>
      <Text style={{ marginTop: 8 }}>{[e.venueName, e.venueAddress].filter(Boolean).join(', ')}</Text>
      {e.leaveWarehouseAt && e.expectedReturnDate ? <Text>{t('ev.window', { leave: formatDateTimeIST(e.leaveWarehouseAt), ret: formatPlainDate(e.expectedReturnDate) })}</Text> : null}
      {e.startsAt ? <Text>{`${t('ev.starts')}: ${formatDateTimeIST(e.startsAt)}`}</Text> : null}
      <Text>{`${t('ev.eventManagers')}: ${e.eventManagers.map((m) => m.fullName).join(', ')}`}</Text>
      <Text>{`${t('ev.storeManagers')}: ${e.storeManagers.map((m) => m.fullName).join(', ')}`}</Text>
      {e.siteContactName ? <Text>{`${t('ev.siteContact')}: ${e.siteContactName} ${e.siteContactPhone ?? ''}`}</Text> : null}
      <Text style={{ fontWeight: '600', marginTop: 12 }}>{t('ev.items')}</Text>
      {e.lines.map((l) => (
        <View key={l.id} style={ui.row}>
          <Text style={{ fontWeight: '600' }}>{`${l.itemName} · ${formatQuantity(l.plannedQty, l.unitCode)}`}</Text>
          <Text style={ui.muted}>{l.sources.map((s) => (s.type === 'warehouse' ? `${s.warehouseCode} ${formatQuantity(s.qty, l.unitCode)}` : t('ev.fromEvent', { number: s.eventNumber ?? '' }))).join(' · ')}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
