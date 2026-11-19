import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { MobilePlatform } from '@artoholic/shared';

export const API_URL: string = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000';
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.1.0';
export const PLATFORM: MobilePlatform = Platform.OS === 'android' ? 'android' : 'ios';
