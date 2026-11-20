import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { t } from '@artoholic/shared';
import { colors } from '../theme';

/** Small shared building blocks so every form has 48 pt targets and consistent labels. */
export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={ui.input} autoCapitalize="none" autoCorrect={false} {...props} />
    </View>
  );
}

/** A password box with a "Show password" button that reveals what was typed. */
export function PasswordField({ label, ...props }: { label: string } & Omit<TextInputProps, 'secureTextEntry'>) {
  const [shown, setShown] = useState(false);
  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      <View style={ui.passwordRow}>
        <TextInput accessibilityLabel={label} style={[ui.input, ui.passwordInput]} autoCapitalize="none" autoCorrect={false} secureTextEntry={!shown} {...props} />
        <Pressable accessibilityRole="button" accessibilityLabel={shown ? t('password.hide') : t('password.show')} style={ui.showButton} onPress={() => setShown((s) => !s)}>
          <Text style={ui.secondaryText}>{shown ? t('password.hide') : t('password.show')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Button({ label, onPress, busy, secondary }: { label: string; onPress: () => void; busy?: boolean; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={[ui.button, secondary && ui.secondary]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={secondary ? ui.secondaryText : ui.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function Message({ children, error }: { children: ReactNode; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : 'text'} style={error ? ui.error : ui.status}>{children}</Text>;
}

export const ui = StyleSheet.create({
  screen: { padding: 20, gap: 4, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', color: colors.brand, marginBottom: 8 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 4, color: colors.ink },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, fontSize: 16, backgroundColor: '#fff' },
  button: { marginTop: 16, minHeight: 48, borderRadius: 8, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  secondaryText: { color: colors.ink, fontSize: 16 },
  error: { color: colors.error, marginTop: 12 },
  status: { color: colors.ink, marginTop: 12 },
  row: { minHeight: 56, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, padding: 12, justifyContent: 'center', marginTop: 8 },
  muted: { color: colors.muted },
  passwordRow: { flexDirection: 'row', gap: 8 },
  passwordInput: { flex: 1 },
  showButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', paddingHorizontal: 12, justifyContent: 'center' }
});
