/** Drizzle table definitions mirroring db/migrations (data-model.md). Used for typed queries. */
import { customType, pgEnum, pgTable, uuid, text, timestamp, boolean, bigserial, jsonb, smallint, integer, primaryKey } from 'drizzle-orm/pg-core';

const citext = customType<{ data: string }>({ dataType: () => 'citext' });
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const inet = customType<{ data: string }>({ dataType: () => 'inet' });

export const userStatus = pgEnum('user_status', ['active', 'deactivated']);
export const roleEnum = pgEnum('role', ['super_admin', 'admin', 'event_manager', 'store_manager']);
export const clientPlatform = pgEnum('client_platform', ['web', 'android', 'ios']);
export const mobilePlatform = pgEnum('mobile_platform', ['android', 'ios']);
export const recordKind = pgEnum('record_kind', ['event', 'damage_report', 'count_session', 'stock_transfer', 'item']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  username: citext('username').notNull().unique(),
  phoneE164: text('phone_e164').unique(),
  email: citext('email').unique(),
  passwordHash: text('password_hash').notNull(),
  status: userStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id').notNull().references(() => users.id),
    role: roleEnum('role').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.role] }) })
);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: bytea('token_hash').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  clientPlatform: clientPlatform('client_platform').notNull(),
  clientVersion: text('client_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true })
});

export const signInAttempts = pgTable('sign_in_attempts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usernameAttempted: citext('username_attempted').notNull(),
  userId: uuid('user_id').references(() => users.id),
  networkAddress: inet('network_address'),
  succeeded: boolean('succeeded').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow()
});

export const auditEntries = pgTable('audit_entries', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  clientPlatform: clientPlatform('client_platform'),
  clientVersion: text('client_version'),
  networkAddress: inet('network_address')
});

export const numberSequences = pgTable(
  'number_sequences',
  {
    kind: recordKind('kind').notNull(),
    year: smallint('year').notNull(),
    lastValue: integer('last_value').notNull()
  },
  (t) => ({ pk: primaryKey({ columns: [t.kind, t.year] }) })
);

export const mobileVersionSettings = pgTable('mobile_version_settings', {
  platform: mobilePlatform('platform').primaryKey(),
  minimumVersion: text('minimum_version').notNull(),
  recommendedVersion: text('recommended_version').notNull(),
  storeUrl: text('store_url').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id)
});

export const systemHeartbeats = pgTable('system_heartbeats', {
  name: text('name').primaryKey(),
  lastBeatAt: timestamp('last_beat_at', { withTimezone: true }).notNull()
});
