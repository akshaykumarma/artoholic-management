import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ApiClientError, cutResultSchema, formatQuantity, hasPermission, itemListSchema, itemViewSchema, t, type ItemView } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { pickPhoto } from '../permissions';
import { uploadItemPhoto } from '../photos/upload';
import { Button, Field, Message, ui } from './ui';

type ListItem = { id: string; code: string; name: string; available: string; unitCode: string | null };

/** Search items by name or any code (003 US7). */
export function ItemListScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { api } = useAuth();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ListItem[]>([]);
  useEffect(() => {
    const h = setTimeout(() => {
      void api.get(`/api/v1/catalogue/items?q=${encodeURIComponent(q)}`, itemListSchema).then((r) => setItems(r.items)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(h);
  }, [api, q]);
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('inv.items')}</Text>
      <Field label={t('inv.search')} value={q} onChangeText={setQ} />
      {items.map((i) => (
        <Pressable key={i.id} accessibilityRole="button" style={ui.row} onPress={() => onOpen(i.id)}>
          <Text style={{ fontWeight: '600' }}>{i.name}</Text>
          <Text style={ui.muted}>{`${i.code} · ${t('inv.available')} ${formatQuantity(i.available, i.unitCode)}`}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const errText = (err: unknown) =>
  err instanceof ApiClientError && err.details?.fields ? Object.values(err.details.fields as Record<string, string>).join(' · ') : err instanceof Error ? err.message : t('error.INTERNAL');

/** Item page with stock by place, pieces, and the phone actions: correct, cut, photo (003 US3–US5). */
export function ItemViewScreen({ id }: { id: string }) {
  const { api, me } = useAuth();
  const [v, setV] = useState<ItemView | null>(null);
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('');
  const [cutLen, setCutLen] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const load = useCallback(async () => setV(await api.get(`/api/v1/catalogue/items/${id}`, itemViewSchema)), [api, id]);
  useEffect(() => {
    void load().catch((e) => setMsg({ text: errText(e), error: true }));
  }, [load]);
  if (!v) return msg ? <Message error>{msg.text}</Message> : null;
  const u = v.item.unitCode;
  const canMove = !!me && hasPermission(me.roles, 'stock.move');
  const bin = v.balances.find((b) => b.locationId && b.condition === 'available');

  async function run(fn: () => Promise<string>) {
    setMsg(null);
    try {
      setMsg({ text: await fn() });
      await load();
    } catch (e) {
      setMsg({ text: errText(e), error: true });
    }
  }

  async function addPhoto() {
    const asset = await pickPhoto();
    if (asset) await run(async () => (await uploadItemPhoto(api, id, asset), t('versions.saved')));
  }

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{v.item.name}</Text>
      <Text style={ui.muted}>{`${v.item.code} · ${v.item.categoryName}`}</Text>
      <Text style={{ marginTop: 8 }} testID="on-hand">{`${t('inv.onHand')}: ${formatQuantity(v.onHand, u)}`}</Text>
      <Text testID="available">{`${t('inv.available')}: ${formatQuantity(v.totals.available ?? '0', u)}`}</Text>
      {v.balances.map((b, i) => (
        <View key={i} style={ui.row}>
          <Text>{`${b.locationCode ?? '—'} ${b.pieceNumber ?? ''}`}</Text>
          <Text style={ui.muted}>{`${t(`inv.condition.${b.condition}`)} · ${formatQuantity(b.quantity, u)}`}</Text>
        </View>
      ))}
      {canMove && bin ? (
        <View>
          <Text style={ui.label}>{t('inv.correct')}</Text>
          <Field label={t('inv.change')} value={change} onChangeText={setChange} placeholder={t('inv.correctHint')} keyboardType="numbers-and-punctuation" />
          <Field label={t('inv.reason')} value={reason} onChangeText={setReason} />
          <Button label={t('inv.submit')} onPress={() => run(async () => {
            const r = await api.post<{ status: string }>('/api/v1/stock/corrections', { itemId: id, locationId: bin.locationId, condition: 'available', quantityChange: change, reason });
            return r.status === 'pending' ? t('inv.requested') : t('inv.applied');
          })} />
        </View>
      ) : null}
      {canMove && v.item.trackingType === 'cut' && v.pieces[0] ? (
        <View>
          <Text style={ui.label}>{`${t('inv.cut')} · ${v.pieces[0].pieceNumber} (${formatQuantity(v.pieces[0].currentLength, u)})`}</Text>
          <Field label={t('inv.cutLength')} value={cutLen} onChangeText={setCutLen} keyboardType="decimal-pad" />
          <Button label={t('inv.cut')} onPress={() => run(async () => {
            const r = await api.post('/api/v1/stock/cuts', { pieceId: v.pieces[0]!.id, length: cutLen }, cutResultSchema);
            return t('inv.cutDone', { len: r.cutPiece.length, off: r.offcut.length, piece: r.offcut.pieceNumber });
          })} />
        </View>
      ) : null}
      {me && hasPermission(me.roles, 'catalogue.manage') ? <Button label={t('inv.addPhoto')} secondary onPress={addPhoto} /> : null}
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </ScrollView>
  );
}
