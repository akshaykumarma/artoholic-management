import type { PoolClient } from 'pg';
import type { RequestContext } from '../http/context';

export interface AuditInput {
  action: string;
  actorUserId?: string | null;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ctx?: Pick<RequestContext, 'platform' | 'version' | 'ip'>;
}

const SECRET_KEYS = /pass(word)?|token|secret|hash|code/i;

/** Removes anything that looks like a credential before it is stored (never store passwords/tokens). */
export function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !SECRET_KEYS.test(k))
        .map(([k, v]) => [k, scrub(v)])
    );
  }
  return value;
}

/** Appends an audit entry inside the caller's transaction (or on the pool). */
export async function writeAudit(db: Pick<PoolClient, 'query'>, entry: AuditInput): Promise<void> {
  await db.query(
    `INSERT INTO audit_entries (actor_user_id, action, entity_type, entity_id, before, after, client_platform, client_version, network_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.actorUserId ?? null,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.before === undefined ? null : JSON.stringify(scrub(entry.before)),
      entry.after === undefined ? null : JSON.stringify(scrub(entry.after)),
      entry.ctx?.platform ?? null,
      entry.ctx?.version ?? null,
      entry.ctx?.ip ?? null
    ]
  );
}
