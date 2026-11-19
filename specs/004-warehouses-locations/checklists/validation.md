# Validation record: 004 Warehouses & Locations

**Date**: 2026-11-19 · **Branch**: `004-implementation`

## Quickstart scenarios

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Create a warehouse (code upper-cased, unique), name 1–5 levels; level count locks once locations exist; Store Managers assigned; SM sees only their warehouses | Pass | `tests/integration/warehouses.test.ts`; e2e `warehouses.spec.ts` |
| 2 | Bulk bins A–B × 1–3 → preview "6 new, 0 already exist" → create; re-run skips existing; > 2,000 or ranges short of bin level refused | Pass | `warehouses.test.ts`; e2e `warehouses.spec.ts` |
| 3 | Move 10 of 25 chairs between bins in one ledger entry; over-quantity refused; default location refused once bins exist (`NOT_A_BIN`) | Pass | `moves-transfers.test.ts`; mobile `warehouses.test.tsx` |
| 4 | Bin suggestions put bins holding the item first | Pass | `moves-transfers.test.ts` |
| 5 | Transfer TRF-YYYY-0001: dispatch → in transit (counted in no warehouse) → receive with confirmed shortfall → Admin marks lost / returns to source; cancel only while requested; SM dispatches only from own warehouse | Pass | `moves-transfers.test.ts` |
| 6 | A bin holding stock cannot be deactivated; an empty one can; warehouse with stock or open transfers cannot be deactivated | Pass | `moves-transfers.test.ts` |

## Checks

- Shared 53/53, web integration and contract 227/227, mobile 21/21, Playwright e2e 9/9.
- Typecheck and lint clean (exit code 0).

## Notes

- Contract tests for `/warehouses` and `/transfers` (T007, T018) are in the integration files, which call the
  route handlers directly and parse responses with the shared zod schemas.
- Map pin: coordinates and a Google Maps link until a Places key is configured (`MAPS_API_KEY_WEB`).
- The inventory page's old `/inventory/warehouses` address redirects to `/warehouses`.
