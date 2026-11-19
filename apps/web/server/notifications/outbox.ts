import type { PoolClient } from 'pg';

/**
 * Records a domain event inside the caller's transaction (research 008 R1). Feature 008 turns
 * outbox rows into in-app, push, WhatsApp and email notifications; rolled-back work emits nothing.
 */
export async function emit(
  tx: Pick<PoolClient, 'query'>,
  trigger: string,
  e: { recordType?: string; recordId?: string; payload?: Record<string, unknown>; actorUserId?: string | null } = {}
): Promise<void> {
  await tx.query(
    'INSERT INTO notification_outbox (trigger, record_type, record_id, payload, actor_user_id) VALUES ($1, $2, $3, $4, $5)',
    [trigger, e.recordType ?? null, e.recordId ?? null, JSON.stringify(e.payload ?? {}), e.actorUserId ?? null]
  );
}
