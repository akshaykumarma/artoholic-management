import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { t } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, Message, ui } from './ui';

/** Self-service reset by 6-digit WhatsApp/email code (002 US3). */
export default function ForgotScreen({ onDone }: { onDone: () => void }) {
  const { api } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : t('error.INTERNAL'), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('forgot.title')}</Text>
      <Text style={ui.muted}>{t('forgot.body')}</Text>
      <Field label={t('signIn.identifier')} value={identifier} onChangeText={setIdentifier} editable={!sent} />
      {sent ? (
        <>
          <Field label={t('reset.code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" />
          <Field label={t('reset.newPassword')} value={password} onChangeText={setPassword} secureTextEntry />
          <Button label={t('reset.submit')} busy={busy} onPress={() => go(async () => {
            await api.post('/api/v1/auth/reset', { identifier, code, newPassword: password });
            setMsg({ text: t('reset.done') });
            onDone();
          })} />
        </>
      ) : (
        <Button label={t('forgot.submit')} busy={busy} onPress={() => go(async () => {
          await api.post('/api/v1/auth/forgot', { identifier });
          setSent(true);
          setMsg({ text: t('forgot.sent') });
        })} />
      )}
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </ScrollView>
  );
}
