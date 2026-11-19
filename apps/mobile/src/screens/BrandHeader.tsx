import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '@artoholic/shared';
import { colors } from '../theme';

/** Text wordmark in the logo's colours (placeholder until the logo file is added). */
export function BrandHeader() {
  return (
    <View style={styles.wrap} accessible accessibilityLabel={t('app.name')}>
      <View style={styles.row}>
        <View style={styles.sun} />
        <Text style={styles.name}>{t('app.name').toLowerCase()}</Text>
      </View>
      <Text style={styles.tagline}>{t('app.tagline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sun: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.saffron, borderWidth: 4, borderColor: colors.brand },
  name: { fontSize: 28, fontWeight: '700', color: colors.brand },
  tagline: { fontStyle: 'italic', color: colors.muted, marginTop: 4 }
});
