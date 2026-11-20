import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Artoholic',
  slug: 'artoholic',
  scheme: 'artoholic',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  // Store identity confirmed by the owner on 2026-11-20 (011 T001).
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'in.artoholic.ops',
    infoPlist: {
      NSCameraUsageDescription: 'The camera is used to photograph damaged items and stock.',
      NSPhotoLibraryUsageDescription: 'Choose a photo of damaged items or stock when the camera is not used.',
      NSFaceIDUsageDescription: 'Unlock the app with Face ID instead of typing your password.'
    }
  },
  android: { package: 'in.artoholic.ops', permissions: ['CAMERA', 'POST_NOTIFICATIONS', 'USE_BIOMETRIC'] },
  // Store listings must not claim Phase 2 features (offline mode, barcode scanning).
  plugins: ['expo-router', 'expo-secure-store', ['expo-notifications', { color: '#EBAB3F' }]],
  experiments: { typedRoutes: false },
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000', eas: { projectId: process.env.EAS_PROJECT_ID } }
};

export default config;
