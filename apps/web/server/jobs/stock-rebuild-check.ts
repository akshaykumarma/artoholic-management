import { getPool } from '../../db/client';
import { logger } from '../http/logger';
import { rebuildMismatches } from '../stock/balances';

export const STOCK_REBUILD_JOB = 'stock-rebuild-check';

/** Nightly: the cached balances must equal the ledger; any difference is logged as an error. */
export async function runStockRebuildCheck(): Promise<number> {
  const mismatches = await rebuildMismatches(getPool());
  if (mismatches.length) logger.error('stock balance mismatch', { count: mismatches.length, sample: mismatches.slice(0, 10) });
  return mismatches.length;
}
