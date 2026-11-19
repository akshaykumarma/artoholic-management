/**
 * Internal stock API used by features 004–007 (003 T033). Nothing else may write stock tables.
 *
 * - postMovements(tx, movements, meta): the only writer of the ledger and balances.
 *   Reserve = available → reserved (same bin, eventId set); release = the reverse;
 *   dispatch = reserved@bin → out@event; return = out@event → available@bin.
 * - balanceOf / rebuildMismatches: read balances and verify the cache against the ledger.
 */
export { postMovements, type MovementInput, type Side } from './post';
export { balanceOf, rebuildMismatches } from './balances';
