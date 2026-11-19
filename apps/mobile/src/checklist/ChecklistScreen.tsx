import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiClientError, draftKey, formatQuantity, SHORT_REASONS, stepSchema, t, type EntryInput, type MessageKey, type Step, type StepRow } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { mobileDraftStore } from '../drafts';
import { enqueuePhoto, forgetStep, processQueue, readQueue } from '../photos/queue';
import { Button, Field, Message, ui } from '../screens/ui';

type Draft = Record<string, EntryInput>;
const num = (v: string | null | undefined) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : 0);
const trim = (v: string | null) => (v === null ? undefined : v.replace(/\.?0+$/, '') || '0');

function fromRow(r: StepRow): EntryInput {
  return { entryId: r.entryId, done: r.done, dispatched: trim(r.dispatched), received: trim(r.received), returned: trim(r.returned), handedOver: trim(r.handedOver),
    handoverEventId: r.handoverEventId ?? r.handoverOptions[0]?.eventId ?? null, consumed: trim(r.consumed), damaged: trim(r.damaged), shortReason: r.shortReason,
    note: r.note, binLocationId: r.binLocationId, pieceId: r.pieceId, photoKeys: r.photoKeys };
}

/**
 * The phone checklist (006 US1–US5): one row per line, numeric fields for the step, entries kept on
 * the device as you type (FR-014) and restored after a restart, damage photos through the upload queue.
 */
export function ChecklistScreen({ eventId, stepId }: { eventId: string; stepId: string }) {
  const { api, me } = useAuth();
  const [step, setStep] = useState<Step | null>(null);
  const [entries, setEntries] = useState<Draft>({});
  const [restored, setRestored] = useState(false);
  const [q, setQ] = useState('');
  const [notDone, setNotDone] = useState(false);
  const [transport, setTransport] = useState({ vehicleNumber: '', driverName: '', driverPhone: '' });
  const [confirm, setConfirm] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = draftKey(me?.id ?? 'anon', `checklist:${stepId}`);

  const load = useCallback(async () => {
    const s = await api.get(`/api/v1/events/${eventId}/steps/${stepId}`, stepSchema);
    setStep(s);
    const base = Object.fromEntries(s.rows.map((r) => [r.entryId, fromRow(r)]));
    const saved = s.status === 'submitted' ? null : await mobileDraftStore.get<Draft>(key);
    setEntries(saved ? { ...base, ...saved } : base);
    setRestored(!!saved);
  }, [api, eventId, stepId, key]);
  useEffect(() => {
    void load().catch((e) => setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true }));
  }, [load]);

  const update = (id: string, patch: Partial<EntryInput>) => setEntries((cur) => {
    const next = { ...cur, [id]: { ...cur[id]!, ...patch } };
    void mobileDraftStore.set(key, next);
    return next;
  });

  // Uploaded photos attach to their line; the rest keep retrying.
  const syncPhotos = useCallback(async () => {
    const done = await processQueue(api, mobileDraftStore);
    const queue = await readQueue(mobileDraftStore);
    setPendingPhotos(queue.filter((p) => p.stepId === stepId && !p.key).length);
    setEntries((cur) => {
      const next = { ...cur };
      for (const p of done.filter((x) => x.stepId === stepId && next[x.entryId])) {
        const keys = next[p.entryId]!.photoKeys ?? [];
        if (!keys.includes(p.key!)) next[p.entryId] = { ...next[p.entryId]!, photoKeys: [...keys, p.key!] };
      }
      void mobileDraftStore.set(key, next);
      return next;
    });
  }, [api, stepId, key]);
  useEffect(() => {
    const h = setInterval(() => void syncPhotos(), 10_000);
    return () => clearInterval(h);
  }, [syncPhotos]);

  const missingOf = (r: StepRow, e: EntryInput | undefined) => {
    if (!step || step.step === 'warehouse_dispatch' || !e) return 0;
    const used = step.step === 'return_dispatch' ? num(e.returned) + num(e.handedOver) + num(e.consumed) + num(e.damaged) : num(e.received) + num(e.damaged);
    return Math.max(0, Math.round((Number(r.expected) - used) * 1000) / 1000);
  };
  const rows = useMemo(() => (step?.rows ?? []).filter((r) => (!q || `${r.itemCode} ${r.itemName} ${r.usualBin ?? ''}`.toLowerCase().includes(q.toLowerCase())) && (!notDone || !entries[r.entryId]?.done)), [step, q, notDone, entries]);
  if (!step) return msg ? <Message error>{msg.text}</Message> : null;
  const locked = step.status === 'submitted' || !step.ready;
  const missingLines = step.rows.filter((r) => missingOf(r, entries[r.entryId]) > 0);

  async function addPhoto(r: StepRow) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const shot = perm.granted ? await ImagePicker.launchCameraAsync({ quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    const asset = !shot.canceled ? shot.assets[0] : undefined;
    if (!asset || !step) return;
    await enqueuePhoto(mobileDraftStore, asset, { stepId, entryId: r.entryId, eventNumber: step.eventNumber });
    await syncPhotos();
  }

  async function submit() {
    if (!step) return;
    setBusy(true);
    setMsg(null);
    try {
      await syncPhotos();
      await api.post(`/api/v1/events/${eventId}/steps/${stepId}/submit`, {
        version: step.version, entries: Object.values(entries), confirmMissing: confirm,
        ...(step.step === 'warehouse_dispatch' ? { transport: { vehicleNumber: transport.vehicleNumber || undefined, driverName: transport.driverName || undefined, driverPhone: transport.driverPhone || undefined } } : {})
      });
      await mobileDraftStore.remove(key);
      await forgetStep(mobileDraftStore, stepId);
      await load();
      setMsg({ text: t('ck.stepStatus.submitted') });
    } catch (err) {
      const fields = err instanceof ApiClientError ? (err.details?.fields as Record<string, string> | undefined) : undefined;
      setMsg({ text: fields ? Object.values(fields).join(' · ') : err instanceof Error ? err.message : t('error.INTERNAL'), error: true });
    } finally {
      setBusy(false);
    }
  }

  const field = (r: StepRow, name: 'dispatched' | 'received' | 'returned' | 'handedOver' | 'consumed' | 'damaged', label: string) => (
    <Field label={label} editable={!locked} keyboardType="decimal-pad" value={(entries[r.entryId]?.[name] as string | undefined) ?? ''}
      onChangeText={(v) => update(r.entryId, { [name]: v || undefined })} />
  );

  const header = (
    <View>
      <Text style={ui.title}>{t(`ck.step.${step.step}` as MessageKey)}</Text>
      <Text style={ui.muted}>{[step.eventNumber, step.eventName, step.warehouseCode, t(`ck.stepStatus.${step.status}` as MessageKey)].filter(Boolean).join(' · ')}</Text>
      {!step.ready && step.status !== 'submitted' ? <Message>{t('ck.notReady')}</Message> : null}
      {restored && !locked ? <Message>{t('ck.restored')}</Message> : null}
      <Field label={t('ck.searchLines')} value={q} onChangeText={setQ} />
      <Button label={t('ck.notDoneOnly')} secondary onPress={() => setNotDone(!notDone)} />
    </View>
  );
  const footer = locked ? (msg ? <Message error={msg.error}>{msg.text}</Message> : null) : (
    <View>
      {step.step === 'warehouse_dispatch' ? (
        <>
          <Field label={t('ck.vehicle')} value={transport.vehicleNumber} autoCapitalize="characters" onChangeText={(v) => setTransport({ ...transport, vehicleNumber: v })} />
          <Field label={t('ck.driver')} value={transport.driverName} onChangeText={(v) => setTransport({ ...transport, driverName: v })} />
          <Field label={t('ck.driverPhone')} value={transport.driverPhone} keyboardType="phone-pad" onChangeText={(v) => setTransport({ ...transport, driverPhone: v })} />
        </>
      ) : null}
      {missingLines.map((r) => <Text key={r.entryId} style={ui.error}>{t('ck.missingLine', { item: r.itemName, n: formatQuantity(String(missingOf(r, entries[r.entryId])), r.unitCode) })}</Text>)}
      {missingLines.length ? <Button label={confirm ? `✓ ${t('ck.confirmMissing')}` : t('ck.confirmMissing')} secondary onPress={() => setConfirm(!confirm)} /> : null}
      {pendingPhotos ? <Message>{t('ck.photoCount', { n: pendingPhotos })}</Message> : null}
      <Button label={t('ck.submit')} busy={busy} onPress={() => void submit()} />
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={ui.screen}
      keyboardShouldPersistTaps="handled"
      data={rows}
      keyExtractor={(r) => r.entryId}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      renderItem={({ item: r }) => {
        const e = entries[r.entryId];
        const short = step.step === 'warehouse_dispatch' && num(e?.dispatched) < Number(r.expected);
        return (
          <View style={ui.row}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!e?.done }} disabled={locked} onPress={() => update(r.entryId, { done: !e?.done })}>
              <Text style={{ fontWeight: '600' }}>{`${e?.done ? '✓ ' : ''}${r.itemName}`}</Text>
            </Pressable>
            <Text style={ui.muted}>{[r.itemCode, r.usualBin, `${t(step.step === 'warehouse_dispatch' ? 'ck.planned' : 'ck.expected')} ${formatQuantity(r.expected, r.unitCode)}`].filter(Boolean).join(' · ')}</Text>
            {step.step === 'warehouse_dispatch' ? field(r, 'dispatched', t('ck.dispatched')) : null}
            {short && !locked ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {SHORT_REASONS.map((s) => <Button key={s} secondary label={`${e?.shortReason === s ? '✓ ' : ''}${t(`ck.reason.${s}` as MessageKey)}`} onPress={() => update(r.entryId, { shortReason: s })} />)}
              </View>
            ) : null}
            {step.step === 'site_receipt' || step.step === 'warehouse_receipt' ? <>{field(r, 'received', t('ck.received'))}{field(r, 'damaged', t('ck.damaged'))}</> : null}
            {step.step === 'return_dispatch' ? (
              <>
                {field(r, 'returned', t('ck.returned'))}
                {r.handoverOptions.length ? field(r, 'handedOver', `${t('ck.handedOver')} · ${r.handoverOptions[0]!.number}`) : null}
                {r.trackingType !== 'counted' ? field(r, 'consumed', t('ck.consumed')) : null}
                {field(r, 'damaged', t('ck.damaged'))}
              </>
            ) : null}
            {step.step !== 'warehouse_dispatch' && missingOf(r, e) > 0 ? <Text style={ui.error}>{`${t('ck.missing')}: ${formatQuantity(String(missingOf(r, e)), r.unitCode)}`}</Text> : null}
            {step.step !== 'warehouse_dispatch' ? (
              <>
                <Field label={t('ck.note')} editable={!locked} value={e?.note ?? ''} onChangeText={(v) => update(r.entryId, { note: v })} />
                <Text style={ui.muted}>{t('ck.photoCount', { n: e?.photoKeys?.length ?? 0 })}</Text>
                {!locked ? <Button label={t('ck.addPhoto')} secondary onPress={() => void addPhoto(r)} /> : null}
              </>
            ) : null}
          </View>
        );
      }}
    />
  );
}
