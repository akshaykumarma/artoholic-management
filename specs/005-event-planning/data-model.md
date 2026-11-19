# Data Model: 005-event-planning

## event_types
`id`, `name`, `status`. Seeded with the spec's list.

## events
| Column | Rules |
| --- | --- |
| id, number | `EVT-YYYY-NNNN` assigned at creation (Drafts included), IST year of creation |
| name (1–150), type_id, description | |
| venue_name, venue_address, latitude, longitude, place_id | required to schedule |
| starts_at, ends_at | timestamptz; ends ≥ starts |
| leave_warehouse_at | timestamptz ≤ starts_at |
| expected_return_date | date ≥ IST date of ends_at |
| site_contact_name, site_contact_phone_e164, notes | |
| status | `draft`, `scheduled`, `dispatching`, `in_transit`, `at_site`, `returning`, `reconciling`, `closed`, `cancelled` |
| cancelled_reason, cancelled_by/at | |
| version | integer, optimistic lock |
| created_by/at, updated_by/at | |

No client fields (Q5).

## event_assignments
`event_id`, `user_id`, `role_on_event` (`event_manager`, `store_manager`), `warehouse_id`
(store managers), `assigned_at`, `removed_at`.

## event_lines
`id`, `event_id`, `item_id`, `planned_qty` (numeric, base unit), `round` (1 here; 006 adds
rounds), `notes`. 006 adds quantity columns.

## event_line_sources
`id`, `event_line_id`, `source_type` (`warehouse`, `event`), `warehouse_id` or
`source_event_id`, `planned_qty`, `reserved_qty`. Sum of sources = line planned.

## overbooking_warnings
`id`, `event_line_source_id`, `shortfall_qty`, `clashing_event_ids` uuid[], `raised_at`,
`resolved_at`, `last_notified_at`.

## Status transitions (this feature)
`draft → scheduled` (validation passes; reserve; notify) ·
`scheduled → draft` not allowed · `draft|scheduled → cancelled` (release; notify) · later
transitions owned by 006.
