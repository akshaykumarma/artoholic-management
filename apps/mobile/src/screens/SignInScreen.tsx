import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiClientError, formatDateTimeIST, t } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import { BrandHeader } from './BrandHeader';
import { PasswordField } from './ui';

export default function SignInScreen({ onForgot }: { onForgot?: () => void }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'SIGN_IN_LOCKED') {
        setError(t('error.SIGN_IN_LOCKED', { time: formatDateTimeIST(String(err.details?.retryAt)) }));
      } else {
        setError(err instanceof Error ? err.message : t('error.INTERNAL'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <BrandHeader />
      <Text style={styles.label}>{t('signIn.identifier')}</Text>
      <TextInput accessibilityLabel={t('signIn.identifier')} style={styles.input} autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
      <PasswordField label={t('signIn.password')} value={password} onChangeText={setPassword} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('signIn.submit')} style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.brandDark} /> : <Text style={styles.buttonText}>{t('signIn.submit')}</Text>}
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {onForgot ? (
        <Pressable accessibilityRole="link" style={styles.link} onPress={onForgot}>
          <Text style={styles.linkText}>{t('signIn.forgot')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.bg },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 4, color: colors.ink },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#d9d4cb', borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#fff', color: colors.ink },
  button: { marginTop: 22, minHeight: 50, borderRadius: 12, backgroundColor: colors.saffron, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.brandDark, fontSize: 16, fontWeight: '700' },
  error: { color: colors.error, marginTop: 12 },
  link: { marginTop: 16, minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.link, textDecorationLine: 'underline' }
});
