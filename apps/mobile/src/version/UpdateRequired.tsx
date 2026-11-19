import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@artoholic/shared';
import { colors } from '../theme';

export function UpdateRequired({ storeUrl }: { storeUrl: string | null }) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Text style={styles.title}>{t('update.title')}</Text>
      <Text style={styles.body}>{t('update.body')}</Text>
      {storeUrl ? (
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => Linking.openURL(storeUrl)}>
          <Text style={styles.buttonText}>{t('update.button')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function UpdatePrompt({ storeUrl, onDismiss }: { storeUrl: string | null; onDismiss: () => void }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.bannerTitle}>{t('update.recommendedTitle')}</Text>
      <Text>{t('update.recommendedBody')}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={onDismiss}>
          <Text>{t('update.later')}</Text>
        </Pressable>
        {storeUrl ? (
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => Linking.openURL(storeUrl)}>
            <Text style={styles.buttonText}>{t('update.now')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '700', color: colors.brand, marginBottom: 12 },
  body: { fontSize: 16, color: colors.ink, marginBottom: 24 },
  button: { backgroundColor: colors.brand, minHeight: 48, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  banner: { margin: 12, padding: 16, borderRadius: 12, backgroundColor: '#fdf3e1', borderColor: colors.saffron, borderWidth: 1 },
  bannerTitle: { fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  secondary: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.line }
});
