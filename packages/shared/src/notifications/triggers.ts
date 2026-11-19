import { t, type MessageKey } from '../i18n';
import { formatDateTimeIST } from '../format/datetime';

/** The 008 trigger catalogue (spec table): group, default channels, recipients, wording and deep link. */
export const NOTIFICATION_GROUPS = ['events', 'damage', 'counts', 'stock', 'reports', 'account'] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];
export const DELIVERY_CHANNELS = ['push', 'whatsapp', 'email'] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export interface TriggerDef {
  group: NotificationGroup;
  /** Channels besides in-app, which is always on. */
  channels: DeliveryChannel[];
  /** `payload`: payload.recipientIds; `admins`: every active Admin and the Super Admin. */
  recipients: 'payload' | 'admins';
  /** Damage alerts to Admins ignore quiet hours (US3). */
  bypassQuietHours?: boolean;
  path: (p: Payload) => string;
}
export type Payload = Record<string, unknown>;

const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const eventPath = (p: Payload) => s(p.link) || `/events/${s(p.eventId)}`;

export const TRIGGERS: Record<string, TriggerDef> = {
  'event.scheduled': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'event.changed': { group: 'events', channels: ['push'], recipients: 'payload', path: eventPath },
  'event.unassigned': { group: 'events', channels: ['push'], recipients: 'payload', path: eventPath },
  'event.cancelled': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'event.round_added': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'event.overbooking_raised': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'event.overbooking_resolved': { group: 'events', channels: ['push'], recipients: 'payload', path: eventPath },
  'event.overbooking_reminder': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'event.dispatch_reminder': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'event.return_reminder': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'event.closed': { group: 'events', channels: ['email'], recipients: 'payload', path: eventPath },
  'checklist.dispatched': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'checklist.dispatch_short': { group: 'events', channels: ['push'], recipients: 'payload', path: eventPath },
  'checklist.returned': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'checklist.handover': { group: 'events', channels: ['push', 'whatsapp'], recipients: 'payload', path: eventPath },
  'damage.reported': { group: 'damage', channels: ['push', 'whatsapp'], recipients: 'payload', bypassQuietHours: true, path: (p) => s(p.link) || `/approvals/damage/${s(p.reportId)}` },
  'damage.decided': { group: 'damage', channels: ['push'], recipients: 'payload', path: (p) => s(p.link) || `/approvals/damage/${s(p.reportId)}` },
  'count.due': { group: 'counts', channels: ['push', 'whatsapp'], recipients: 'payload', path: (p) => s(p.link) },
  'count.overdue': { group: 'counts', channels: ['push', 'whatsapp'], recipients: 'payload', path: (p) => s(p.link) },
  'count.submitted': { group: 'counts', channels: ['push'], recipients: 'payload', path: (p) => s(p.link) },
  'count.recount': { group: 'counts', channels: ['push'], recipients: 'payload', path: (p) => s(p.link) },
  'count.completed': { group: 'counts', channels: [], recipients: 'payload', path: (p) => s(p.link) },
  'stock.low': { group: 'stock', channels: ['email'], recipients: 'admins', path: (p) => `/inventory/items/${s(p.itemId)}` },
  'stock.request_pending': { group: 'stock', channels: ['push'], recipients: 'admins', path: () => '/inventory/approvals' },
  'transfer.shortfall': { group: 'stock', channels: ['push'], recipients: 'admins', path: (p) => `/warehouses/transfers/${s(p.transferId)}` },
  'report.ready': { group: 'reports', channels: ['whatsapp', 'email'], recipients: 'payload', path: (p) => s(p.link) || '/reports' },
  'message.failed': { group: 'account', channels: [], recipients: 'payload', path: () => '/admin/messages' },
  'auth.password_reset': { group: 'account', channels: ['whatsapp', 'email'], recipients: 'payload', path: () => '/sign-in' }
};

export function triggerDef(trigger: string): TriggerDef {
  return TRIGGERS[trigger] ?? { group: 'events', channels: [], recipients: 'payload', path: (p) => s(p.link) || '/' };
}

/** Title and one-line summary (translation-ready: `ntf.<trigger>.title|body` with payload values). */
export function renderNotification(trigger: string, p: Payload): { title: string; body: string; path: string } {
  const params = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => [k, typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? formatDateTimeIST(v) : (v as string | number)]));
  const key = (part: string) => `ntf.${trigger}.${part}` as MessageKey;
  let title: string;
  let body: string;
  try {
    title = t(key('title'), params);
    body = t(key('body'), params);
  } catch {
    title = trigger;
    body = '';
  }
  if (title === undefined || title.startsWith('ntf.')) title = trigger;
  return { title: title.replace(/\{\w+\}/g, '').trim(), body: (body ?? '').replace(/\{\w+\}/g, '').replace(/\s+·\s*$/, '').trim(), path: triggerDef(trigger).path(p) };
}
