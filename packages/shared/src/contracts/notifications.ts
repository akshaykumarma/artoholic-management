import { z } from 'zod';
import { DELIVERY_CHANNELS, NOTIFICATION_GROUPS } from '../notifications/triggers';

export const notificationSchema = z.object({
  id: z.string().uuid(), trigger: z.string(), title: z.string(), body: z.string(), path: z.string().nullable(),
  createdAt: z.string(), readAt: z.string().nullable()
});
export type Notification = z.infer<typeof notificationSchema>;
export const notificationListSchema = z.object({ items: z.array(notificationSchema), nextCursor: z.string().nullable(), unread: z.number() });
export const unreadCountSchema = z.object({ unread: z.number() });

const groupPrefs = z.object({ push: z.boolean(), whatsapp: z.boolean(), email: z.boolean() });
export const preferencesSchema = z.object({
  groups: z.record(z.enum(NOTIFICATION_GROUPS), groupPrefs),
  quietHours: z.object({ enabled: z.boolean(), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const pushRegistrationSchema = z.object({ expoToken: z.string().min(10).max(200) });

export const messageSchema = z.object({
  id: z.string().uuid(), channel: z.enum(['whatsapp', 'email']), toAddress: z.string(), trigger: z.string(), templateName: z.string().nullable(),
  renderedText: z.string(), attachments: z.array(z.object({ name: z.string(), size: z.number().optional() })), recordType: z.string().nullable(),
  recordId: z.string().nullable(), status: z.string(), queuedAt: z.string(), sentAt: z.string().nullable(),
  events: z.array(z.object({ status: z.string(), detail: z.string().nullable(), at: z.string() }))
});
export type Message = z.infer<typeof messageSchema>;

export const providerSettingsSchema = z.object({
  channel: z.enum(['whatsapp', 'email']),
  config: z.record(z.string()),
  hasSecret: z.boolean(),
  updatedAt: z.string().nullable()
});
export const providerUpdateSchema = z.object({ config: z.record(z.string().max(300)), secret: z.string().max(2000).optional() });
export const templateMappingSchema = z.object({
  trigger: z.string(), channel: z.enum(['whatsapp', 'email']), templateName: z.string().min(1).max(120), language: z.string().min(2).max(10).default('en'),
  variables: z.array(z.string().max(60)).max(10).default([]), bodyText: z.string().max(2000).default('')
});
export type TemplateMapping = z.infer<typeof templateMappingSchema>;
export const DELIVERY = DELIVERY_CHANNELS;
