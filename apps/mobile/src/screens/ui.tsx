import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        <Pressable accessibilityRole="button" accessibilityLabel={shown ? t('password.hide') : t('password.show')} hitSlop={8} style={ui.eye} onPress={() => setShown((s) => !s)}>
          <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

export function Button({ label, onPress, busy, secondary }: { label: string; onPress: () => void; busy?: boolean; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={[ui.button, secondary && ui.secondary]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.brandDark} /> : <Text style={secondary ? ui.secondaryText : ui.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function Message({ children, error }: { children: ReactNode; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : 'text'} style={error ? ui.error : ui.status}>{children}</Text>;
}

export const ui = StyleSheet.create({
  screen: { padding: 20, gap: 4, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.brandDark, marginBottom: 8, letterSpacing: -0.3 },
  label: { fontWeight: '600', fontSize: 14, marginTop: 14, marginBottom: 6, color: colors.ink },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#d9d4cb', borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: colors.surface, color: colors.ink },
  button: { marginTop: 18, minHeight: 50, borderRadius: 12, backgroundColor: colors.saffron, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, shadowColor: '#b9770e', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  buttonText: { color: colors.brandDark, fontSize: 16, fontWeight: '700' },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#d9d4cb', shadowOpacity: 0, elevation: 0 },
  secondaryText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  error: { color: colors.error, marginTop: 12, backgroundColor: '#fde4e1', borderRadius: 10, padding: 10, overflow: 'hidden' },
  status: { color: colors.ink, marginTop: 12 },
  row: { minHeight: 56, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 14, justifyContent: 'center', marginTop: 10, shadowColor: '#1f2328', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  muted: { color: colors.muted },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  eye: { position: 'absolute', right: 4, top: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }
});
