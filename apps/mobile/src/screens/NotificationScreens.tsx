import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Switch, Text, View } from 'react-native';
import { DELIVERY_CHANNELS, formatDateTimeIST, mobilePath, notificationListSchema, NOTIFICATION_GROUPS, preferencesSchema, t, type MessageKey, type Notification, type Preferences } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, Message, ui } from './ui';

/** Notification centre (008 US2): newest first; opening one marks it read and follows its link. */
export function NotificationsScreen({ onOpen, onSettings }: { onOpen: (path: string) => void; onSettings: () => void }) {
  const { api } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    const r = await api.get('/api/v1/notifications', notificationListSchema);
    setItems(r.items);
    setUnread(r.unread);
  }, [api]);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);
  return (
    <FlatList
      contentContainerStyle={ui.screen}
      data={items}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={(
        <View>
          <Text style={ui.title}>{t('ntf.title')}</Text>
          <Text style={ui.muted}>{t('ntf.unread', { n: unread })}</Text>
          <Button label={t('ntf.readAll')} secondary onPress={() => void api.post('/api/v1/notifications/read-all', {}).then(load)} />
          <Button label={t('ntf.settings')} secondary onPress={onSettings} />
        </View>
      )}
      ListEmptyComponent={<Text style={ui.muted}>{t('ntf.none')}</Text>}
      renderItem={({ item: n }) => (
        <Pressable accessibilityRole="button" style={[ui.row, !n.readAt && { borderLeftWidth: 4, borderLeftColor: '#EBAB3F' }]}
          onPress={() => void api.post(`/api/v1/notifications/${n.id}/read`, {}).finally(() => onOpen(mobilePath(n.path)))}>
          <Text style={{ fontWeight: '600' }}>{n.title}</Text>
          {n.body ? <Text>{n.body}</Text> : null}
          <Text style={ui.muted}>{formatDateTimeIST(n.createdAt)}</Text>
        </Pressable>
      )}
    />
  );
}

/** Channels per group and quiet hours (008 US3). */
export function NotificationSettingsScreen() {
  const { api } = useAuth();
  const [p, setP] = useState<Preferences | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    void api.get('/api/v1/me/notification-preferences', preferencesSchema).then(setP).catch(() => undefined);
  }, [api]);
  if (!p) return null;
  const flip = (g: keyof Preferences['groups'], c: 'push' | 'whatsapp' | 'email') => setP({ ...p, groups: { ...p.groups, [g]: { ...p.groups[g]!, [c]: !p.groups[g]![c] } } });
  return (
    <FlatList
      contentContainerStyle={ui.screen}
      data={NOTIFICATION_GROUPS.filter((g) => g !== 'account')}
      keyExtractor={(g) => g}
      ListHeaderComponent={<Text style={ui.title}>{t('ntf.settings')}</Text>}
      renderItem={({ item: g }) => (
        <View style={ui.row}>
          <Text style={{ fontWeight: '600' }}>{t(`ntf.group.${g}` as MessageKey)}</Text>
          {DELIVERY_CHANNELS.map((c) => (
            <View key={c} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
              <Text>{t(`ntf.channel.${c}` as MessageKey)}</Text>
              <Switch accessibilityLabel={`${t(`ntf.group.${g}` as MessageKey)} · ${t(`ntf.channel.${c}` as MessageKey)}`} value={!!p.groups[g]?.[c]} onValueChange={() => flip(g, c)} />
            </View>
          ))}
        </View>
      )}
      ListFooterComponent={(
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginTop: 12 }}>
            <Text style={{ flex: 1 }}>{t('ntf.quiet')}</Text>
            <Switch accessibilityLabel={t('ntf.quiet')} value={p.quietHours.enabled} onValueChange={(v) => setP({ ...p, quietHours: { ...p.quietHours, enabled: v } })} />
          </View>
          <Field label={t('ntf.quietFrom')} value={p.quietHours.start} onChangeText={(v) => setP({ ...p, quietHours: { ...p.quietHours, start: v } })} />
          <Field label={t('ntf.quietTo')} value={p.quietHours.end} onChangeText={(v) => setP({ ...p, quietHours: { ...p.quietHours, end: v } })} />
          <Button label={t('ntf.save')} onPress={() => void api.put('/api/v1/me/notification-preferences', p).then(() => setMsg({ text: t('ntf.saved') })).catch((e: Error) => setMsg({ text: e.message, error: true }))} />
          {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
        </View>
      )}
    />
  );
}
