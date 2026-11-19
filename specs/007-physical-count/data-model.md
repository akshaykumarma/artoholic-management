# Data Model: 007-physical-count

## count_schedules
`id`, `name`, `frequency` (`weekly`, `monthly`, `quarterly`, `half_yearly`, `yearly`),
`start_date`, `anchor_day`, `next_due_date`, `blind` (default true), `status` (`active`,
`paused`), `created_by/at`.

## count_schedule_scope
`schedule_id`, `warehouse_id?`, `category_id?` (empty = all items, all warehouses).

## count_schedule_assignees
`schedule_id`, `user_id` (Store Manager).

## count_sessions
`id`, `number` (`CNT-YYYY-NNNN`), `schedule_id?` (null = ad hoc), `due_date`, `blind`,
`status` (`open`, `submitted`, `in_review`, `completed`), `snapshot_at`,
`snapshot_movement_id`, `submitted_by/at`, `completed_at`.

## count_lines
`id`, `session_id`, `item_id`, `piece_id?`, `location_id`, `condition`, `recorded_qty`,
`counted_qty` (null = not counted), `photo_key?`, `note`, `counted_by/at`, `added_by_counter`
bool, `event_movement_flag` bool, `variance_qty` (derived), `variance_paise` (derived at
replacement value), `decision` (`matched`, `pending`, `approved`, `rejected`), `decision_reason`,
`decided_by/at`, `movement_id`, `recount_of_line_id?`.

## Session states
`open` → (submit) `submitted` → (first decision) `in_review` → (all lines decided)
`completed`; rejected lines are reopened in the same session for recount.
