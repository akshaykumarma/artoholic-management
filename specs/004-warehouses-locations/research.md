# Research: 004-warehouses-locations

## R1. Location tree and codes
- **Decision**: `locations` adjacency list (`parent_id`, `level` 1–N, `segment` text) with the
  full `code` materialised at creation (`MAIN-A-03-02`) and unique platform-wide. Only bins
  (level = warehouse's level count) hold stock; a check in `postMovements()` refuses non-bin
  locations except the warehouse's default location during migration.
- **Alternatives**: ltree/closure table (not needed: trees are shallow, ≤ 5 levels).

## R2. Bulk creation
- **Decision**: Request carries per-level ranges (letters `A–D` or numbers `1–10`) or lists.
  The shared code builder expands the Cartesian product, pads numbers to the widest number in the
  range, and the server previews (create / skip existing) before commit; limit 2,000 per request.

## R3. Default-location migration
- **Decision**: 003's default location stays valid until emptied; moving stock out is an ordinary
  `move`. When empty, it can be deactivated; once a warehouse has bins, new stock cannot be put
  into its default location.

## R4. Transfers
- **Decision**: States `requested → dispatched → received` (or `cancelled` before dispatch).
  Dispatch posts `transfer_out` (bin → `in_transit`, location null, `transfer_id` set); receive
  posts `transfer_in` (`in_transit` → destination bin). Shortfall: remaining in-transit quantity
  is confirmed missing and becomes an Admin decision: `lost` (movement to `lost`) or `return`
  (back to the source bin). Numbered `TRF-YYYY-NNNN` via 001 sequences.

## R5. Map pin
- **Decision**: Store `latitude`, `longitude`, `place_id?`; web uses Places autocomplete; mobile
  opens the pin in Google/Apple Maps. API key restricted by HTTP referrer / app ID.

## R6. Bin picker
- **Decision**: Trigram index on `locations.code`; "usual bins" = top 3 bins by quantity of that
  item in the warehouse.
