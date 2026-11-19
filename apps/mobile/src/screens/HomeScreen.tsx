import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { t } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

export default function HomeScreen({ onOpen }: { onOpen?: (path: string) => void }) {
  const { me, signOut } = useAuth();
  if (!me) return null;
  const items = me.menu.filter((m) => m.moduleId !== 'home');
  const roles = me.roles.map((r) => t(`role.${r}`)).join(', ');
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>{t('home.welcome', { name: me.fullName })}</Text>
      <Text style={styles.muted}>{t('home.roles', { roles: roles || '—' })}</Text>
      {items.length === 0 ? <Text style={styles.empty}>{t('home.noModules')}</Text> : null}
      {items.map((m) => (
        <Pressable key={m.moduleId} accessibilityRole="button" style={styles.item} onPress={() => onOpen?.(m.path)}>
          <Text style={styles.itemText}>{t(m.labelKey as Parameters<typeof t>[0])}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" style={styles.signOut} onPress={signOut}>
        <Text>{t('signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: colors.brand },
  muted: { color: colors.muted, marginBottom: 12 },
  empty: { color: colors.ink, marginVertical: 12 },
  item: { minHeight: 56, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, justifyContent: 'center' },
  itemText: { fontSize: 17, color: colors.ink },
  signOut: { marginTop: 24, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.line }
});
