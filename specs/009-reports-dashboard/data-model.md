# Data Model: 009-reports-dashboard

## report_schedules
`id`, `report_id` (`R1`…`R10`), `filters` jsonb (validated by the report's schema),
`frequency` (`daily`, `weekly`, `monthly`), `weekday` (1–7, weekly), `month_day` (1–31,
monthly), `time_ist` (HH:mm), `owner_user_id` (Admin), `status` (`active`, `paused`),
`created/updated`.

## report_schedule_recipients
`schedule_id`, `user_id` — must hold `admin` (Q13); removed automatically on deactivation or
role loss (owner notified).

## report_runs
`id`, `report_id`, `schedule_id?`, `requested_by?`, `filters`, `started_at`, `finished_at`,
`row_count`, `file_key`, `status` (`running`, `succeeded`, `failed`), `error`.
Delivery records are 008 `messages` linked by `record_type='report_run'`.

## Report catalogue
As in [spec](spec.md) (R1–R10); columns defined in `packages/shared/src/reports/registry.ts`.
