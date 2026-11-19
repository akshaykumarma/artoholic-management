import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { damageReportSchema, formatDateTimeIST, formatQuantity, hasPermission, myStepsSchema, t, type DamageReport, type MessageKey } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, Message, ui } from './ui';

type MyStep = { stepId: string; step: string; warehouseCode: string | null; eventId: string; eventNumber: string; eventName: string };

/** Checklists waiting for me, and damage reports to decide (Admins) or that I sent. */
export function ApprovalsScreen({ onOpenStep, onOpenReport }: { onOpenStep: (eventId: string, stepId: string) => void; onOpenReport: (id: string) => void }) {
  const { api, me } = useAuth();
  const [steps, setSteps] = useState<MyStep[]>([]);
  const [reports, setReports] = useState<DamageReport[]>([]);
  const admin = !!me && hasPermission(me.roles, 'damage.approve');
  useEffect(() => {
    void api.get('/api/v1/checklists/mine', myStepsSchema).then((r) => setSteps(r.items)).catch(() => undefined);
    if (me && hasPermission(me.roles, 'damage.report')) {
      void api.get<{ items: DamageReport[] }>(`/api/v1/damage-reports${admin ? '?status=pending' : ''}`).then((r) => setReports(r.items)).catch(() => undefined);
    }
  }, [api, me, admin]);
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('ck.title')}</Text>
      <Text style={{ fontWeight: '600' }}>{t('ck.myTasks')}</Text>
      {steps.length ? steps.map((s) => (
        <Pressable key={s.stepId} accessibilityRole="button" style={ui.row} onPress={() => onOpenStep(s.eventId, s.stepId)}>
          <Text style={{ fontWeight: '600' }}>{[t(`ck.step.${s.step}` as MessageKey), s.warehouseCode].filter(Boolean).join(' · ')}</Text>
          <Text style={ui.muted}>{`${s.eventNumber} · ${s.eventName}`}</Text>
        </Pressable>
      )) : <Text style={ui.muted}>{t('ck.noTasks')}</Text>}
      <Text style={{ fontWeight: '600', marginTop: 12 }}>{t('ck.damageReports')}</Text>
      {reports.length ? reports.map((r) => (
        <Pressable key={r.id} accessibilityRole="button" style={ui.row} onPress={() => onOpenReport(r.id)}>
          <Text style={{ fontWeight: '600' }}>{`${r.number} · ${r.itemName}`}</Text>
          <Text style={ui.muted}>{`${t(`dmg.kind.${r.kind}` as MessageKey)} ${formatQuantity(r.quantity, null)} · ${t(`dmg.status.${r.status}` as MessageKey)}`}</Text>
        </Pressable>
      )) : <Text style={ui.muted}>{t('ck.noReports')}</Text>}
    </ScrollView>
  );
}

/** Opened from the push notification: Approve is one tap (US3-4: ≤ 3 taps). */
export function DamageReportScreen({ id }: { id: string }) {
  const { api, me } = useAuth();
  const [r, setR] = useState<DamageReport | null>(null);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    void api.get(`/api/v1/damage-reports/${id}`, damageReportSchema).then(setR).catch((e) => setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true }));
  }, [api, id]);
  if (!r) return msg ? <Message error>{msg.text}</Message> : null;
  const decide = async (kind: 'approve' | 'reject') => {
    setMsg(null);
    try {
      setR(await api.post(`/api/v1/damage-reports/${id}/${kind}`, kind === 'approve' ? { comment: comment || undefined } : { comment }, damageReportSchema));
      setMsg({ text: t('dmg.decided') });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true });
    }
  };
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('dmg.title', { number: r.number })}</Text>
      <Text style={{ fontWeight: '600' }}>{`${t(`dmg.kind.${r.kind}` as MessageKey)}: ${formatQuantity(r.quantity, null)} · ${r.itemName}`}</Text>
      <Text style={ui.muted}>{`${r.eventNumber} · ${t(`ck.step.${r.step}` as MessageKey)}`}</Text>
      <Text>{t('dmg.reportedBy', { who: r.reportedBy, when: formatDateTimeIST(r.reportedAt) })}</Text>
      {r.note ? <Text>{r.note}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {r.photos.map((p) => <Image key={p.id} source={{ uri: p.url }} accessibilityLabel={r.itemName} style={{ width: 150, height: 150, borderRadius: 8 }} />)}
      </View>
      {r.photosDeleted ? <Text style={ui.muted}>{t('dmg.photosDeleted')}</Text> : null}
      <Text style={{ marginTop: 8 }}>{t(`dmg.status.${r.status}` as MessageKey)}</Text>
      {r.status === 'pending' && me && hasPermission(me.roles, 'damage.approve') ? (
        <>
          <Field label={t('dmg.comment')} value={comment} onChangeText={setComment} />
          <Button label={t('dmg.approve')} onPress={() => void decide('approve')} />
          <Button label={t('dmg.reject')} secondary onPress={() => void decide('reject')} />
        </>
      ) : null}
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </ScrollView>
  );
}
