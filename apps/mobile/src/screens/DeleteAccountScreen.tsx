import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { formatDateIST, t } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Message, ui } from './ui';

/** "Request account deletion" (011 FR-007): explains what happens, then tells Admins. */
export function DeleteAccountScreen() {
  const { api } = useAuth();
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [sent, setSent] = useState(false);
  async function send() {
    try {
      const r = await api.post<{ dueAt: string }>('/api/v1/me/deletion-request', {});
      setSent(true);
      setMsg({ text: t('del.sent', { date: formatDateIST(r.dueAt) }) });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('error.INTERNAL'), error: true });
    }
  }
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('del.request')}</Text>
      <Text>{t('del.explain')}</Text>
      {!sent ? <Button label={t('del.confirm')} onPress={() => void send()} /> : null}
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </ScrollView>
  );
}
