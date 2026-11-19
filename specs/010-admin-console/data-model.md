# Data Model: 010-admin-console

## company_profile (single row)
`name`, `logo_key`, `gstin` (15-char format check), `address`, `phone_e164`, `email`,
`updated_by/at`.

## master_list_values
`id`, `list` (`event_type`, `damage_reason`, `short_dispatch_reason`, …), `value`,
`position`, `status` (`active`, `archived`). (Units stay in 003's `units` table, managed here.)

## backup_records
`id`, `started_at`, `finished_at`, `database_bytes`, `files_synced`, `location`, `status`,
`error`.

## restore_tests
`id`, `performed_at`, `performed_by`, `backup_record_id`, `observed_rpo_hours`,
`observed_rto_hours`, `result`, `notes`.

## retention_runs
`id`, `rule` (`damage_photos`, `ledger_rollup`, `audit_archive`), `ran_at`, `removed_count`,
`status`, `detail`.

## stock_movements_archive / audit_entries_archive
Same columns as live tables; written only by the maintenance role.
