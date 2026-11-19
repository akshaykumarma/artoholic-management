import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { dashboardSchema, formatMoney, formatQuantity, REPORTS, reportResultSchema, t, type Dashboard, type ReportId, type ReportResult } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { shareReport } from '../reports/share';
import { Button, Field, Message, ui } from './ui';

export function ReportListScreen({ onOpen }: { onOpen: (id: ReportId) => void }) {
  return (
    <FlatList
      contentContainerStyle={ui.screen}
      data={Object.values(REPORTS)}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={<Text style={ui.title}>{t('rpt.title')}</Text>}
      renderItem={({ item: r }) => (
        <Pressable accessibilityRole="button" style={ui.row} onPress={() => onOpen(r.id)}>
          <Text style={{ fontWeight: '600' }}>{`${r.id} · ${r.title}`}</Text>
        </Pressable>
      )}
    />
  );
}

const show = (type: string, v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? '—' : type === 'money' ? formatMoney(Number(v)) : type === 'quantity' ? formatQuantity(String(v), null) : String(v);

/** View a report on the phone and share it as Excel (FR-008). */
export function ReportScreen({ id }: { id: ReportId }) {
  const { api } = useAuth();
  const def = REPORTS[id];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const filters = () => ({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const run = async () => {
    setMsg(null);
    try {
      setResult(await api.post(`/api/v1/reports/${id}/run`, { filters: filters(), page: 1, pageSize: 200 }, reportResultSchema));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true });
    }
  };
  useEffect(() => { void run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [first, ...rest] = def.columns;
  return (
    <FlatList
      contentContainerStyle={ui.screen}
      data={result?.rows ?? []}
      keyExtractor={(_, i) => String(i)}
      ListHeaderComponent={(
        <View>
          <Text style={ui.title}>{def.title}</Text>
          {def.filters.includes('from') ? <Field label={t('rpt.filter.from')} value={from} placeholder="YYYY-MM-DD" onChangeText={setFrom} /> : null}
          {def.filters.includes('to') ? <Field label={t('rpt.filter.to')} value={to} placeholder="YYYY-MM-DD" onChangeText={setTo} /> : null}
          <Button label={t('rpt.run')} onPress={() => void run()} />
          <Button label={t('rpt.share')} secondary onPress={() => void shareReport(api, id, filters(), def.title).catch((e: Error) => setMsg({ text: e.message, error: true }))} />
          {result ? <Text style={ui.muted}>{t('rpt.rows', { n: result.total })}</Text> : null}
          {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
        </View>
      )}
      ListEmptyComponent={result ? <Text style={ui.muted}>{t('rpt.noData')}</Text> : null}
      renderItem={({ item: r }) => (
        <View style={ui.row}>
          <Text style={{ fontWeight: '600' }}>{show(first!.type, r[first!.key])}</Text>
          <Text style={ui.muted}>{rest.map((c) => `${c.label}: ${show(c.type, r[c.key])}`).join(' · ')}</Text>
        </View>
      )}
    />
  );
}

/** Compact Admin figures on the phone's home screen (009 US3), refreshed every 60 s. */
export function DashboardCard({ onOpen }: { onOpen: (path: string) => void }) {
  const { api } = useAuth();
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => {
    const load = () => void api.get('/api/v1/dashboard', dashboardSchema).then(setD).catch(() => undefined);
    load();
    const h = setInterval(load, 60_000);
    return () => clearInterval(h);
  }, [api]);
  if (!d) return null;
  const p = d.pendingApprovals;
  const pending = p.damage + p.variances + p.writeOffs + p.corrections + p.transferShortfalls;
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
      {[
        [t('dash.approvals'), String(pending), '/approvals'],
        [t('dash.today', { d: d.today.dispatches, r: d.today.returns }), '', '/events/today'],
        [t('dash.overbooked'), String(d.overbookedCount), '/events'],
        [t('dash.lowStock'), String(d.lowStockCount), '/inventory'],
        [t('dash.damageValue'), formatMoney(d.damageValueMonthPaise), '/reports/R4']
      ].map(([label, value, path]) => (
        <Pressable key={label} accessibilityRole="button" style={[ui.row, { minWidth: 150 }]} onPress={() => onOpen(path!)}>
          <Text style={ui.muted}>{label}</Text>
          {value ? <Text style={{ fontSize: 22, fontWeight: '700' }}>{value}</Text> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
