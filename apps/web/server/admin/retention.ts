import type { PoolClient } from 'pg';
import { getPool, withTransaction } from '../../db/client';
import { now } from '../auth/clock';
import { logger } from '../http/logger';
import { getStorage } from '../storage';
import { rebuildMismatches } from '../stock/balances';

type Tx = Pick<PoolClient, 'query'>;
const THREE_YEARS_MS = 3 * 365.25 * 86_400_000;

async function record(db: Tx, rule: string, removed: number, status: string, detail = '') {
  await db.query('INSERT INTO retention_runs (rule, ran_at, removed_count, status, detail) VALUES ($1, $2, $3, $4, $5)', [rule, now(), removed, status, detail]);
}

/** (a) Damage photos 6 months after the decision, only once the event is Closed; the report stays (Q12, US6-1). */
export async function purgeDamagePhotos(): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; storage_key: string; damage_report_id: string }>(
    `SELECT p.id, p.storage_key, p.damage_report_id FROM damage_photos p JOIN damage_reports d ON d.id = p.damage_report_id JOIN events e ON e.id = d.event_id
      WHERE p.deleted_at IS NULL AND p.delete_after IS NOT NULL AND p.delete_after < $1 AND d.status <> 'pending' AND e.status = 'closed'`, [now()]
  );
  for (const p of rows) {
    await getStorage().deleteObject(p.storage_key);
    await pool.query('UPDATE damage_photos SET deleted_at = $2 WHERE id = $1', [p.id, now()]);
  }
  await pool.query(
    `UPDATE damage_reports d SET photos_deleted_at = $2 WHERE d.id = ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM damage_photos p WHERE p.damage_report_id = d.id AND p.deleted_at IS NULL)`,
    [[...new Set(rows.map((r) => r.damage_report_id))], now()]
  );
  await record(pool, 'damage_photos', rows.length, 'succeeded');
  return rows.length;
}

/**
 * (b) Ledger roll-up (research R4): movements older than 3 years move to the archive and are replaced by
 * one opening movement per balance key at the cutoff, in one transaction that checks the balances still
 * equal the ledger before committing (US6-2). Nothing moves while any of those movements belongs to an
 * event that is not Closed.
 */
export async function rollUpLedger(cutoff: Date = new Date(now().getTime() - THREE_YEARS_MS)): Promise<{ status: string; archived: number }> {
  return withTransaction(async (tx) => {
    const { rows: open } = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM stock_movements m JOIN events e ON e.id IN (m.from_event_id, m.to_event_id) WHERE m.occurred_at < $1 AND e.status <> 'closed'`, [cutoff]
    );
    if (open[0]!.n > 0) {
      await record(tx, 'ledger_rollup', 0, 'blocked', `${open[0]!.n} old movements belong to events that are not Closed`);
      return { status: 'blocked', archived: 0 };
    }
    const { rows: keys } = await tx.query<{ item_id: string; piece_id: string | null; location_id: string | null; event_id: string | null; transfer_id: string | null; condition: string; q: string }>(
      `WITH sides AS (
         SELECT item_id, from_piece_id AS piece_id, from_location_id AS location_id, from_event_id AS event_id, from_transfer_id AS transfer_id, from_condition AS condition, -quantity AS q
           FROM stock_movements WHERE from_condition IS NOT NULL AND occurred_at < $1
         UNION ALL
         SELECT item_id, to_piece_id, to_location_id, to_event_id, to_transfer_id, to_condition, quantity FROM stock_movements WHERE to_condition IS NOT NULL AND occurred_at < $1)
       SELECT item_id, piece_id, location_id, event_id, transfer_id, condition::text, sum(q)::text AS q FROM sides GROUP BY 1, 2, 3, 4, 5, 6 HAVING sum(q) <> 0`, [cutoff]
    );
    if (keys.some((k) => Number(k.q) < 0)) {
      await record(tx, 'ledger_rollup', 0, 'blocked', 'A balance at the cutoff would be negative');
      return { status: 'blocked', archived: 0 };
    }
    const moved = await tx.query('INSERT INTO stock_movements_archive SELECT * FROM stock_movements WHERE occurred_at < $1', [cutoff]);
    if (!moved.rowCount) {
      await record(tx, 'ledger_rollup', 0, 'succeeded', 'Nothing older than 3 years');
      return { status: 'succeeded', archived: 0 };
    }
    await tx.query('ALTER TABLE stock_movements DISABLE TRIGGER stock_movements_append_only');
    await tx.query('DELETE FROM stock_movements WHERE occurred_at < $1', [cutoff]);
    await tx.query('ALTER TABLE stock_movements ENABLE TRIGGER stock_movements_append_only');
    for (const k of keys) {
      await tx.query(
        `INSERT INTO stock_movements (type, item_id, from_piece_id, to_piece_id, quantity, to_location_id, to_event_id, to_transfer_id, to_condition, reason, reference_type, occurred_at)
         VALUES ('opening', $1, $2, $2, $3, $4, $5, $6, $7::stock_condition, 'Roll-up of movements before the retention cutoff', 'retention', $8)`,
        [k.item_id, k.piece_id, k.q, k.location_id, k.event_id, k.transfer_id, k.condition, cutoff]
      );
    }
    const mismatches = await rebuildMismatches(tx);
    if (mismatches.length) throw new Error(`Roll-up would change ${mismatches.length} balances; rolled back`);
    await record(tx, 'ledger_rollup', moved.rowCount, 'succeeded', `${keys.length} opening entries`);
    return { status: 'succeeded', archived: moved.rowCount };
  });
}

/** (c) Audit entries older than 3 years move to the archive (kept for legal hold, not shown). */
export async function archiveAudit(cutoff: Date = new Date(now().getTime() - THREE_YEARS_MS)): Promise<number> {
  return withTransaction(async (tx) => {
    const moved = await tx.query('INSERT INTO audit_entries_archive SELECT * FROM audit_entries WHERE occurred_at < $1', [cutoff]);
    if (moved.rowCount) {
      await tx.query('ALTER TABLE audit_entries DISABLE TRIGGER audit_entries_append_only');
      await tx.query('DELETE FROM audit_entries WHERE occurred_at < $1', [cutoff]);
      await tx.query('ALTER TABLE audit_entries ENABLE TRIGGER audit_entries_append_only');
    }
    await record(tx, 'audit_archive', moved.rowCount ?? 0, 'succeeded');
    return moved.rowCount ?? 0;
  });
}

/** Nightly 03:00 IST. A failing rule is recorded and does not stop the others. */
export async function runRetention(): Promise<void> {
  for (const [rule, fn] of [['damage_photos', purgeDamagePhotos], ['ledger_rollup', rollUpLedger], ['audit_archive', archiveAudit]] as const) {
    try {
      await (fn as () => Promise<unknown>)();
    } catch (err) {
      logger.error('retention rule failed', { rule, error: (err as Error).message });
      await record(getPool(), rule, 0, 'failed', (err as Error).message.slice(0, 500));
    }
  }
}

export const RULES = [
  { rule: 'damage_photos', description: 'Damage photos: deleted 6 months after the report is decided, once the event is Closed. The report itself is kept forever.' },
  { rule: 'ledger_rollup', description: 'Stock ledger: kept 3 years; older entries are rolled into one opening entry per item, bin and condition, and archived.' },
  { rule: 'audit_archive', description: 'Audit log: kept 3 years in the app; older entries are archived.' },
  { rule: 'forever', description: 'Kept forever: item photos, damage records, the WhatsApp and email message log.' }
];

export async function retentionView() {
  const { rows } = await getPool().query('SELECT DISTINCT ON (rule) rule, ran_at, removed_count, status, detail FROM retention_runs ORDER BY rule, ran_at DESC');
  return RULES.map((r) => {
    const last = rows.find((x) => x.rule === r.rule);
    return { ...r, lastRun: last ? { at: new Date(last.ran_at).toISOString(), removed: last.removed_count, status: last.status, detail: last.detail } : null };
  });
}
