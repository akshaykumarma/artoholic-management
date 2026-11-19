import { getPool, withTransaction } from '../../../db/client';
import { syncReservations } from '../../events/reservations';
import { evaluateWarnings } from '../../events/warnings';

export const WARNINGS_SWEEP_JOB = 'event-warnings-sweep';

/**
 * Every 2 minutes (SC-004): tops up reservations as stock arrives and re-evaluates every
 * Scheduled event's over-booking warnings, so stock changes clear or raise warnings promptly.
 */
export async function sweepWarnings(): Promise<void> {
  const { rows } = await getPool().query<{ id: string }>("SELECT id FROM events WHERE status = 'scheduled' ORDER BY leave_warehouse_at");
  for (const r of rows) {
    await withTransaction(async (tx) => {
      await tx.query('SELECT 1 FROM events WHERE id = $1 FOR UPDATE', [r.id]);
      await syncReservations(tx, r.id, null);
      await evaluateWarnings(tx, [r.id]);
    });
  }
}
