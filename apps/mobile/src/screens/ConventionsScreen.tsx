import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONVENTION_SAMPLES, t } from '@artoholic/shared';
import { colors } from '../theme';

export default function ConventionsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>{t('conventions.title')}</Text>
      {CONVENTION_SAMPLES.map((s) => (
        <View key={s.id} style={styles.row}>
          <Text style={styles.label}>{s.label}</Text>
          <Text testID={`sample-${s.id}`} style={styles.value}>{s.render()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.brand, marginBottom: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { color: colors.muted, fontSize: 13 },
  value: { fontSize: 17, color: colors.ink, marginTop: 2 }
});
