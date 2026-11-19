export const ROLES = ['super_admin', 'admin', 'event_manager', 'store_manager'] as const;
export type Role = (typeof ROLES)[number];

export const CLIENT_PLATFORMS = ['web', 'android', 'ios'] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];
export type MobilePlatform = Exclude<ClientPlatform, 'web'>;
