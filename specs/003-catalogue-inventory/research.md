# Research: 003-catalogue-inventory

## R1. Ledger shape
- **Decision**: One `stock_movements` table: `type`, `item_id`, `piece_id?`, `quantity`
  (positive), `from_location_id?`, `from_condition?`, `to_location_id?`, `to_condition?`,
  `reference_type/id`, `reason`, `actor`, `occurred_at`, `corrects_movement_id?`. Inbound
  (opening, receipt) has only `to_*`; outbound terminal (write-off, lost, consumed) has
  `to_condition` terminal. A move is a pair (from, to) in one row.
- **Rationale**: One row per physical change keeps history readable and rebuild trivial
  (sum of to − sum of from per location × condition).
- **Alternatives**: Signed double-entry rows (two rows per move; harder to read in history).

## R2. Balances and concurrency
- **Decision**: `stock_balances(item_id, piece_id, location_id, condition, quantity)` updated in
  the same transaction by `postMovements()`, which locks the affected balance rows
  (`SELECT … FOR UPDATE` in a fixed key order to avoid deadlocks) and refuses any result < 0 with
  `INSUFFICIENT_STOCK`. A nightly job recomputes balances from the ledger and alerts on any
  mismatch (SC-002).
- **Alternatives**: Computing balances on every read (too slow at 500k rows for the item view).

## R3. Conditions
- **Decision**: In-bin conditions `available`, `reserved`, `damaged`; at-event `out`;
  terminal `lost`, `written_off`, `consumed`. On hand = available + reserved + out + damaged.
  Reservation is a movement available → reserved at the same location, referencing the event
  (used by 005).

## R4. Quantities and units
- **Decision**: `numeric(14,3)` in base unit of the item's unit family; API takes decimal
  strings plus a unit code and converts with exact decimal arithmetic (`decimal.js` in shared).
  Counted items: integer check.

## R5. Cut products
- **Decision**: `item_pieces` per roll/length with `piece_number` (`<itemCode>-P<n>`, offcuts
  `-P<n>.<m>`), `current_length`, `parent_piece_id`. A cut = movement type `cut` that reduces the
  parent piece and creates a child piece of the cut length at the same location and condition;
  item total length unchanged. Balances for cut items are per piece (quantity = length).

## R6. Item codes with history
- **Decision**: `item_codes(code citext UNIQUE, item_id, active_from, active_to)`; current code =
  row with `active_to IS NULL`. Uniqueness across all codes ever is the table's unique index
  (001 clarification). Auto codes use 001's `number_sequences` kind `item`.

## R7. Photos
- **Decision**: Device compresses (longest side 1600 px, JPEG q0.8) then uploads directly to the
  bucket with a presigned PUT (5 min); server records metadata after verifying size ≤ 10 MB and
  content type. Reads via presigned GET (15 min).

## R8. Search
- **Decision**: `pg_trgm` GIN index on `items.name` and `item_codes.code`; filters by joins on
  balances. Meets 1 s at 10k items comfortably.

## R9. Import
- **Decision**: Upload → server parses (`exceljs` / `csv-parse`), validates each row against
  shared zod schemas, stores a preview in `import_batches.preview` (jsonb). Confirm commits in one
  transaction (≤ 5,000 rows) using `postMovements()` with type `opening` and reference the batch.

## R10. Corrections and write-offs
- **Decision**: `correction_requests` (Store Manager) with status pending → approved/rejected;
  approval posts the movement. Admin direct corrections post immediately with
  `reference_type='admin_correction'`. Write-offs reuse the same table with `kind='write_off'`.

## R11. Low-stock alert
- **Decision**: After each `postMovements()`, compare available-before and available-after per
  affected item against `minimum_stock`; on downward crossing enqueue a `stock.low` notification
  (delivered by 008; in-app only until then).
