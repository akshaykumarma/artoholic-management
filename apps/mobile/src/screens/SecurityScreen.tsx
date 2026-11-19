import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { BIOMETRIC_KEY, biometricsAvailable } from '../auth/BiometricGate';
import { ui } from './ui';

/** Biometric toggle; hidden when the device has no fingerprint/face enrolled (002 US5-3). */
export default function SecurityScreen() {
  const { api } = useAuth();
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    void (async () => {
      setAvailable(await biometricsAvailable());
      setOn((await AsyncStorage.getItem(BIOMETRIC_KEY)) === 'on');
    })();
  }, []);

  async function toggle(value: boolean) {
    setOn(value);
    await AsyncStorage.setItem(BIOMETRIC_KEY, value ? 'on' : 'off');
    await api.put('/api/v1/auth/biometric', { enabled: value }).catch(() => undefined);
  }

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('security.title')}</Text>
      {available ? (
        <View style={[ui.row, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text>{t('security.biometric')}</Text>
          <Switch accessibilityLabel={t('security.biometric')} value={on} onValueChange={toggle} />
        </View>
      ) : null}
    </ScrollView>
  );
}
