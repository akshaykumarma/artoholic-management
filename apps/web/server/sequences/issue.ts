import type { PoolClient } from 'pg';
import { formatRecordNumber, isYearly, istYear, type RecordKind } from '@artoholic/shared';
import { now } from '../auth/clock';

/**
 * Issues the next number inside the caller's transaction (research R6). The upsert's row lock
 * serialises concurrent issuers; a rollback releases the increment, so numbers are unique,
 * consecutive and never reused.
 */
export async function issueRecordNumber(tx: Pick<PoolClient, 'query'>, kind: RecordKind): Promise<string> {
  const year = isYearly(kind) ? istYear(now()) : 0;
  const { rows } = await tx.query<{ last_value: number }>(
    `INSERT INTO number_sequences (kind, year, last_value) VALUES ($1, $2, 1)
     ON CONFLICT (kind, year) DO UPDATE SET last_value = number_sequences.last_value + 1
     RETURNING last_value`,
    [kind, year]
  );
  return formatRecordNumber(kind, year, rows[0]!.last_value);
}
