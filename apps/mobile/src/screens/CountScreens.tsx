import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { ApiClientError, countSheetSchema, draftKey, formatPlainDate, formatQuantity, t, type CountSessionRow, type CountSheet, type MessageKey } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { mobileDraftStore } from '../drafts';
import { Button, Field, Message, ui } from './ui';

export function CountListScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { api } = useAuth();
  const [items, setItems] = useState<CountSessionRow[]>([]);
  useEffect(() => {
    void api.get<{ items: CountSessionRow[] }>('/api/v1/counts/sessions').then((r) => setItems(r.items)).catch(() => undefined);
  }, [api]);
  return (
    <FlatList
      contentContainerStyle={ui.screen}
      data={items}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={<Text style={ui.title}>{t('cnt.title')}</Text>}
      ListEmptyComponent={<Text style={ui.muted}>{t('cnt.none')}</Text>}
      renderItem={({ item: s }) => (
        <Pressable accessibilityRole="button" style={ui.row} onPress={() => onOpen(s.id)}>
          <Text style={{ fontWeight: '600' }}>{`${s.number} · ${formatPlainDate(s.dueDate)}${s.overdue ? ` · ${t('cnt.overdue')}` : ''}`}</Text>
          <Text style={ui.muted}>{`${t(`cnt.status.${s.status}` as MessageKey)} · ${t('cnt.progress', { counted: s.countedCount, total: s.lineCount })}`}</Text>
        </Pressable>
      )}
    />
  );
}

type Draft = Record<string, string>;

/** Count on the phone (007 US3): bin order, blind when set, saved on the device as you go (FR-009). */
export function CountSheetScreen({ id }: { id: string }) {
  const { api, me } = useAuth();
  const [sheet, setSheet] = useState<CountSheet | null>(null);
  const [counts, setCounts] = useState<Draft>({});
  const [restored, setRestored] = useState(false);
  const [q, setQ] = useState('');
  const [confirmZero, setConfirmZero] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const key = draftKey(me?.id ?? 'anon', `count:${id}`);
  const load = useCallback(async () => {
    const s = await api.get(`/api/v1/counts/sessions/${id}/sheet`, countSheetSchema);
    setSheet(s);
    const base = Object.fromEntries(s.lines.map((l) => [l.id, l.countedQty === null ? '' : l.countedQty.replace(/\.?0+$/, '') || '0']));
    const saved = s.canCount ? await mobileDraftStore.get<Draft>(key) : null;
    setCounts(saved ? { ...base, ...saved } : base);
    setRestored(!!saved);
  }, [api, id, key]);
  useEffect(() => {
    void load().catch((e) => setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true }));
  }, [load]);
  const lines = useMemo(() => (sheet?.lines ?? []).filter((l) => !q || `${l.locationCode} ${l.itemCode} ${l.itemName}`.toLowerCase().includes(q.toLowerCase())), [sheet, q]);
  if (!sheet) return msg ? <Message error>{msg.text}</Message> : null;
  const editable = (decision: string | null) => sheet.canCount && (decision === null || decision === 'recount');
  const set = (lineId: string, v: string) => setCounts((cur) => {
    const next = { ...cur, [lineId]: v };
    void mobileDraftStore.set(key, next);
    return next;
  });
  const entries = () => sheet.lines.filter((l) => editable(l.decision)).map((l) => ({ lineId: l.id, countedQty: counts[l.id] === '' || counts[l.id] === undefined ? null : counts[l.id]! }));
  async function run(submit: boolean) {
    setMsg(null);
    try {
      await api.put(`/api/v1/counts/sessions/${id}/entries`, { entries: entries() });
      if (submit) {
        await api.post(`/api/v1/counts/sessions/${id}/submit`, { confirmZero });
        await mobileDraftStore.remove(key);
        await load();
      }
      setMsg({ text: submit ? t('cnt.status.submitted') : t('cnt.saved') });
    } catch (e) {
      setMsg({ text: e instanceof ApiClientError || e instanceof Error ? e.message : t('error.INTERNAL'), error: true });
    }
  }
  return (
    <FlatList
      contentContainerStyle={ui.screen}
      keyboardShouldPersistTaps="handled"
      data={lines}
      keyExtractor={(l) => l.id}
      ListHeaderComponent={(
        <View>
          <Text style={ui.title}>{`${t('cnt.sheet')} · ${sheet.number}`}</Text>
          <Text style={ui.muted}>{[t(`cnt.status.${sheet.status}` as MessageKey), sheet.blind ? t('cnt.blind') : ''].filter(Boolean).join(' · ')}</Text>
          {restored && sheet.canCount ? <Message>{t('cnt.restored')}</Message> : null}
          <Field label={t('ck.searchLines')} value={q} onChangeText={setQ} />
        </View>
      )}
      renderItem={({ item: l }) => (
        <View style={ui.row}>
          <Text style={{ fontWeight: '600' }}>{`${l.locationCode} · ${l.itemName}${l.pieceNumber ? ` · ${l.pieceNumber}` : ''}`}</Text>
          <Text style={ui.muted}>{[t(`inv.condition.${l.condition}` as MessageKey), l.recordedQty !== undefined ? `${t('cnt.recorded')} ${formatQuantity(l.recordedQty, l.unitCode)}` : null, l.eventMovement ? t('cnt.eventMovement') : null].filter(Boolean).join(' · ')}</Text>
          <Field label={`${t('cnt.counted')} · ${l.locationCode} · ${l.itemName}`} keyboardType="decimal-pad" editable={editable(l.decision)} value={counts[l.id] ?? ''} onChangeText={(v) => set(l.id, v)} />
        </View>
      )}
      ListFooterComponent={sheet.canCount ? (
        <View>
          <Button label={confirmZero ? `✓ ${t('cnt.confirmZero')}` : t('cnt.confirmZero')} secondary onPress={() => setConfirmZero(!confirmZero)} />
          <Button label={t('cnt.save')} secondary onPress={() => void run(false)} />
          <Button label={t('cnt.submit')} onPress={() => void run(true)} />
          {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
        </View>
      ) : (msg ? <Message error={msg.error}>{msg.text}</Message> : null)}
    />
  );
}
