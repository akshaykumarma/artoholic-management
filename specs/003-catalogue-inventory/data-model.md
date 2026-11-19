# Data Model: 003-catalogue-inventory

## categories
`id`, `name` (1–80), `parent_id` (nullable, max depth 2), `status` (`active`|`archived`).
Unique (`parent_id`, lower(`name`)).

## units
`code` PK (e.g. `m`, `cm`, `kg`), `name`, `family` (`length`, `mass`, `volume`, `count_set`),
`factor_to_base` numeric (base: m, kg, L, set), `status`.

## items
| Column | Rules |
| --- | --- |
| id | uuid |
| name | 1–120 |
| category_id | FK, must be active on create |
| description | ≤ 2,000 |
| tracking_type | `counted` \| `measured` \| `cut`; immutable after first movement |
| unit_code | null iff counted |
| replacement_value_paise | bigint ≥ 0, per unit/piece/metre |
| minimum_stock | numeric(14,3) ≥ 0, nullable |
| minimum_usable_length | cut only |
| notes, status (`active`/`archived`), created/updated |

## item_codes
`code` citext UNIQUE, `item_id`, `active_from`, `active_to` (null = current). One current per item.

## item_photos
`id`, `item_id`, `storage_key`, `bytes`, `width`, `height`, `uploaded_by`, `uploaded_at`,
`position` (1–5). Kept forever.

## item_pieces (cut products)
`id`, `item_id`, `piece_number` unique, `original_length`, `current_length` ≥ 0,
`parent_piece_id`, `status` (`active`, `written_off`, `consumed`).

## locations (minimal here; 004 extends)
`id`, `warehouse_id`, `code`, `is_default` — one default per warehouse until 004.
Warehouses are a minimal table here (`id`, `code`, `name`, `status`) that 004 extends.

## stock_movements (append-only)
| Column | Rules |
| --- | --- |
| id | bigserial |
| type | `opening`, `receipt`, `reserve`, `release`, `dispatch`, `return`, `move`, `damage`, `repair_ok`, `lost`, `write_off`, `consume`, `cut`, `transfer_out`, `transfer_in`, `handover`, `adjustment`, `correction` |
| item_id, piece_id | piece required for cut items |
| quantity | numeric(14,3) > 0, base unit |
| from_location_id, from_condition | nullable |
| to_location_id, to_condition | nullable |
| reference_type, reference_id | `event`, `event_line`, `count_session`, `transfer`, `import_batch`, `correction_request`, `damage_report`, `admin_correction` |
| corrects_movement_id | nullable FK self |
| reason | required for adjustment, correction, write_off |
| actor_user_id, occurred_at, client_platform | |

DB role: INSERT/SELECT only.

## stock_balances (cache)
PK (`item_id`, `piece_id` (0-uuid when none), `location_id`, `condition`), `quantity` ≥ 0
(CHECK). `location_id` null allowed only for `out` (at an event) with `event_id` column set.

## correction_requests
`id`, `kind` (`correction`, `write_off`), `item_id`, `piece_id`, `location_id`, `condition`,
`quantity_change` (signed), `reason`, `requested_by`, `status` (`pending`, `approved`,
`rejected`), `decided_by`, `decided_at`, `decision_note`, `movement_id`.

## import_batches
`id`, `kind` (`items`, `opening_stock`, …), `file_key`, `uploaded_by`, `preview` jsonb,
`error_count`, `status` (`previewed`, `committed`, `discarded`), `committed_at`.

## Derived
- On hand = Σ balances where condition ∈ {available, reserved, damaged, out}.
- Last used in = latest `dispatch` movement's event for the item.
