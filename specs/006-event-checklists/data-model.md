# Data Model: 006-event-checklists

## dispatch_rounds
`id`, `event_id`, `round` (1…), `created_by/at`. Round 1 created on scheduling; later rounds by
Admin (EVT-24) with their own `event_lines` (`round` column from 005).

## checklist_steps
`id`, `round_id`, `step` (`warehouse_dispatch`, `site_receipt`, `return_dispatch`,
`warehouse_receipt`), `warehouse_id` (warehouse steps), `status` (`not_started`,
`in_progress`, `submitted`), `version`, `submitted_by/at`, `client_platform`, `client_version`,
`device_label`, `latitude`, `longitude` (nullable), `vehicle_number`, `driver_name`,
`driver_phone_e164` (dispatch steps; one set per submission).

## checklist_entries
`id`, `step_id`, `event_line_source_id`, `piece_id?`, `qty_dispatched`, `qty_received`,
`qty_returned`, `qty_handed_over`, `handover_event_id`, `qty_consumed`, `qty_damaged`,
`qty_missing`, `remaining_length`, `short_reason`, `note`, `bin_location_id` (warehouse
receipt), `photo_keys` text[], `updated_by/at`. Only the columns relevant to the step are used.

## event_lines (extended from 005, per source)
Running totals: `dispatched`, `received`, `returned`, `handed_over`, `consumed`,
`damaged_approved`, `lost_approved` — maintained by submissions and decisions; `reconciled`
derived.

## damage_reports (damage records kept forever)
`id`, `number` (`DMG-YYYY-NNNNN`), `event_id`, `event_line_source_id`, `step_id`, `kind`
(`damaged`, `missing`), `quantity`, `reason`, `note`, `reported_by/at`, `status` (`pending`,
`approved`, `rejected`), `decided_by/at`, `decision_comment`, `movement_id`,
`photos_deleted_at` (set by 010 retention).

## damage_photos
`id`, `damage_report_id`, `storage_key`, `taken_at`, `taken_by`, `bytes`, `delete_after`
(= decided_at + 6 months).

## handovers
`id`, `giving_event_id`, `receiving_event_id`, `giving_step_id`, `receiving_step_id`, lines via
entries; the receiving event's site receipt for that source counts as its dispatch.

## event_corrections
`id`, `event_id`, `event_line_source_id`, `field`, `old_value`, `new_value`, `reason`,
`by`, `at`, `movement_id`.

## Event status (completes 005's machine)
`scheduled → dispatching → in_transit → at_site → returning → reconciling → closed`; closure
requires every source reconciled and no `pending`/`rejected` damage report.
