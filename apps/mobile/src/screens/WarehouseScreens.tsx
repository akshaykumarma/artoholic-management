import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ApiClientError, hasPermission, itemListSchema, t, transferSchema, type MessageKey, type Transfer } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { BinPicker } from '../components/BinPicker';
import { Button, Field, Message, ui } from './ui';

type Warehouse = { id: string; code: string; name: string; status: string };
type TransferRow = { id: string; number: string; status: string; fromWarehouseCode: string; toWarehouseCode: string; shortfallPending: boolean };

const errText = (err: unknown) =>
  err instanceof ApiClientError && err.details?.fields ? Object.values(err.details.fields as Record<string, string>).join(' · ') : err instanceof Error ? err.message : t('error.INTERNAL');

export function WarehouseListScreen({ onMove, onTransfers }: { onMove: (warehouseId: string) => void; onTransfers: () => void }) {
  const { api, me } = useAuth();
  const [items, setItems] = useState<Warehouse[]>([]);
  useEffect(() => {
    void api.get<{ items: Warehouse[] }>('/api/v1/warehouses').then((r) => setItems(r.items.filter((w) => w.status === 'active'))).catch(() => undefined);
  }, [api]);
  const canMove = !!me && hasPermission(me.roles, 'stock.move');
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('wh.title')}</Text>
      <Button label={t('tr.title')} secondary onPress={onTransfers} />
      {items.map((w) => (
        <View key={w.id} style={ui.row}>
          <Text style={{ fontWeight: '600' }}>{`${w.code} · ${w.name}`}</Text>
          {canMove ? <Button label={t('wh.move')} secondary onPress={() => onMove(w.id)} /> : null}
        </View>
      ))}
    </ScrollView>
  );
}

/** Move within a warehouse with the bin picker (004 US3). */
export function MoveScreen({ warehouseId }: { warehouseId: string }) {
  const { api } = useAuth();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [item, setItem] = useState<{ id: string; name: string } | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (item) return;
    const h = setTimeout(() => {
      void api.get(`/api/v1/catalogue/items?q=${encodeURIComponent(q)}`, itemListSchema).then((r) => setItems(r.items)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(h);
  }, [api, q, item]);
  async function submit() {
    setMsg(null);
    try {
      await api.post('/api/v1/stock/moves', { itemId: item!.id, fromLocationId: from, toLocationId: to, quantity: qty, condition: 'available' });
      setMsg({ text: t('wh.moved') });
      setQty('');
    } catch (e) {
      setMsg({ text: errText(e), error: true });
    }
  }
  return (
    <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
      <Text style={ui.title}>{t('wh.move')}</Text>
      {item ? (
        <Pressable accessibilityRole="button" style={ui.row} onPress={() => setItem(null)}>
          <Text style={{ fontWeight: '600' }}>{item.name}</Text>
        </Pressable>
      ) : (
        <>
          <Field label={t('tr.item')} value={q} onChangeText={setQ} />
          {items.slice(0, 6).map((i) => (
            <Pressable key={i.id} accessibilityRole="button" style={ui.row} onPress={() => setItem(i)}>
              <Text>{`${i.code} · ${i.name}`}</Text>
            </Pressable>
          ))}
        </>
      )}
      {item ? (
        <>
          <BinPicker label={t('wh.from')} warehouseId={warehouseId} itemId={item.id} onChange={setFrom} />
          <BinPicker label={t('wh.to')} warehouseId={warehouseId} onChange={setTo} />
          <Field label={t('wh.quantity')} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
          <Button label={t('wh.move')} onPress={() => void submit()} />
        </>
      ) : null}
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </ScrollView>
  );
}

export function TransferListScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { api } = useAuth();
  const [items, setItems] = useState<TransferRow[]>([]);
  useEffect(() => {
    void api.get<{ items: TransferRow[] }>('/api/v1/transfers').then((r) => setItems(r.items)).catch(() => undefined);
  }, [api]);
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('tr.title')}</Text>
      {items.map((x) => (
        <Pressable key={x.id} accessibilityRole="button" style={ui.row} onPress={() => onOpen(x.id)}>
          <Text style={{ fontWeight: '600' }}>{`${x.number} · ${x.fromWarehouseCode} → ${x.toWarehouseCode}`}</Text>
          <Text style={ui.muted}>{t(`tr.status.${x.status}` as MessageKey)}{x.shortfallPending ? ` · ${t('tr.shortfallPending')}` : ''}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Dispatch from the source bins, or receive into destination bins (004 US4). */
export function TransferScreen({ id }: { id: string }) {
  const { api } = useAuth();
  const [tr, setTr] = useState<Transfer | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [bins, setBins] = useState<Record<string, string | null>>({});
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const load = useCallback(async () => {
    const x = await api.get(`/api/v1/transfers/${id}`, transferSchema);
    setTr(x);
    setQty(Object.fromEntries(x.lines.map((l) => [l.id, (x.status === 'requested' ? l.requestedQty : l.dispatchedQty ?? '0').replace(/\.?0+$/, '')])));
  }, [api, id]);
  useEffect(() => {
    void load().catch((e) => setMsg({ text: errText(e), error: true }));
  }, [load]);
  if (!tr) return msg ? <Message error>{msg.text}</Message> : null;
  const dispatching = tr.status === 'requested';
  const lines = tr.lines.filter((l) => dispatching || (l.dispatchedQty && l.dispatchedQty !== '0.000'));
  async function submit(confirmMissing: boolean) {
    setMsg(null);
    try {
      if (dispatching) {
        await api.post(`/api/v1/transfers/${id}/dispatch`, { lines: lines.map((l) => ({ lineId: l.id, dispatchedQty: qty[l.id] || '0', fromLocationId: bins[l.id] })) });
      } else {
        await api.post(`/api/v1/transfers/${id}/receive`, { lines: lines.map((l) => ({ lineId: l.id, receivedQty: qty[l.id] || '0', toLocationId: bins[l.id] })), confirmMissing });
      }
      setMsg({ text: t('tr.done') });
      await load();
    } catch (e) {
      setMsg({ text: errText(e), error: true });
    }
  }
  const open = tr.status === 'requested' || tr.status === 'dispatched';
  return (
    <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
      <Text style={ui.title}>{tr.number}</Text>
      <Text style={ui.muted}>{`${tr.fromWarehouseCode} → ${tr.toWarehouseCode} · ${t(`tr.status.${tr.status}` as MessageKey)}`}</Text>
      {lines.map((l) => (
        <View key={l.id} style={ui.row}>
          <Text style={{ fontWeight: '600' }}>{l.itemName}</Text>
          {open ? (
            <>
              <BinPicker label={dispatching ? t('tr.fromBin') : t('tr.toBin')} warehouseId={dispatching ? tr.fromWarehouseId : tr.toWarehouseId} itemId={l.itemId}
                onChange={(b) => setBins((cur) => ({ ...cur, [l.id]: b }))} />
              <Field label={`${t('wh.quantity')} · ${l.itemName}`} value={qty[l.id] ?? ''} keyboardType="decimal-pad" onChangeText={(v) => setQty((cur) => ({ ...cur, [l.id]: v }))} />
            </>
          ) : (
            <Text style={ui.muted}>{`${t('tr.received')} ${l.receivedQty ?? '—'} · ${t('tr.missing')} ${l.missingQty ?? '—'}`}</Text>
          )}
        </View>
      ))}
      {open ? <Button label={dispatching ? t('tr.dispatch') : t('tr.receive')} onPress={() => void submit(false)} /> : null}
      {tr.status === 'dispatched' ? <Button label={t('tr.confirmMissing')} secondary onPress={() => void submit(true)} /> : null}
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </ScrollView>
  );
}
