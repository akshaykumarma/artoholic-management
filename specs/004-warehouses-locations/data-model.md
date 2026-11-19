# Data Model: 004-warehouses-locations

## warehouses (extends 003)
`code` (2–8 `[A-Z0-9]`, unique, immutable once bins exist), `name`, `address`, `latitude`,
`longitude`, `place_id`, `contact_phone_e164`, `status` (`active`/`deactivated`). Store Managers
via 002 `warehouse_assignments` (FK now enforced).

## warehouse_levels
`warehouse_id`, `position` 1–5, `name` (e.g. Aisle). Count fixed once locations exist; names editable.

## locations (extends 003)
`id`, `warehouse_id`, `parent_id`, `level`, `segment` (e.g. `A`, `03`), `code` unique,
`is_default`, `status`. Bin = `level` = warehouse level count. Cannot deactivate while any
balance > 0 at it or any open transfer/event line references it.

## transfers
`id`, `number` (`TRF-YYYY-NNNN`), `from_warehouse_id`, `to_warehouse_id` (≠ from), `status`
(`requested`, `dispatched`, `received`, `cancelled`), `requested_by/at`, `dispatched_by/at`,
`received_by/at`, `notes`.

## transfer_lines
`id`, `transfer_id`, `item_id`, `piece_id?`, `requested_qty`, `dispatched_qty`,
`received_qty`, `missing_qty`, `shortfall_decision` (`pending`, `lost`, `returned`),
`decided_by/at`, `from_location_id`, `to_location_id`.

## Stock condition added
`in_transit` (location null, `transfer_id` set on the balance row). Excluded from available in
every warehouse.

## Transfer state machine
`requested` → (dispatch) `dispatched` → (receive) `received`; `requested` → (cancel)
`cancelled`. A received transfer with `missing_qty > 0` stays "shortfall pending" until decided.
