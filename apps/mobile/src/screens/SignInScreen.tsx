import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiClientError, formatDateTimeIST, t } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import { BrandHeader } from './BrandHeader';

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
      <Text style={styles.label}>{t('signIn.password')}</Text>
      <TextInput accessibilityLabel={t('signIn.password')} style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('signIn.submit')} style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('signIn.submit')}</Text>}
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
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, fontSize: 16, backgroundColor: '#fff' },
  button: { marginTop: 20, minHeight: 48, borderRadius: 8, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: colors.error, marginTop: 12 },
  link: { marginTop: 16, minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.brand, textDecorationLine: 'underline' }
});
