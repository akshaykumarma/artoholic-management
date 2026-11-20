import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { ApiClientError, t, type MessageKey } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, PasswordField, Message, ui } from './ui';

/** Required after sign-in with a temporary password (002 FR-008). */
export default function ChangePasswordScreen() {
  const { api, refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/v1/auth/change-password', { currentPassword: current, newPassword: next });
      await refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'PASSWORD_POLICY') {
        setError(((err.details?.rules as string[]) ?? []).map((r) => t(`password.rule.${r}` as MessageKey)).join(' · '));
      } else setError(err instanceof Error ? err.message : t('error.INTERNAL'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('change.title')}</Text>
      <PasswordField label={t('change.current')} value={current} onChangeText={setCurrent} />
      <PasswordField label={t('change.new')} value={next} onChangeText={setNext} />
      <Text style={ui.muted}>{[t('password.rule.length'), t('password.rule.notIdentifier'), t('password.rule.notCommon')].join(' · ')}</Text>
      <Button label={t('change.submit')} busy={busy} onPress={submit} />
      {error ? <Message error>{error}</Message> : null}
    </ScrollView>
  );
}
