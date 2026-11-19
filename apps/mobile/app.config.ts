import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Artoholic',
  slug: 'artoholic',
  scheme: 'artoholic',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: false, bundleIdentifier: 'in.artoholic.ops' },
  android: { package: 'in.artoholic.ops' },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: { typedRoutes: false },
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000' }
};

export default config;
