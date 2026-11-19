# Research: 009-reports-dashboard

## R1. Report registry
- **Decision**: Each report = `{ id, title, filters (zod), columns [{ key, label, type:
  text|date|datetime|money|quantity|number, unitKey? }], query(scope, filters, page) }`. Screens
  and Excel share the column spec, so they can't disagree.

## R2. Excel generation
- **Decision**: `exceljs` streaming `WorkbookWriter` to a temp file then upload; header rows:
  report title, filters, "Generated DD-MM-YYYY HH:mm IST"; money cells numeric with format
  `₹#,##,##0.00`; dates as real Excel dates formatted `dd-mm-yyyy`; quantities numeric with unit
  in the column header. Empty result → a single "No data for this period" row.

## R3. Scheduling
- **Decision**: Schedules stored with IST time; a minute-level cron computes due schedules
  (weekly day, monthly date clamped to month end) with idempotency key (schedule, IST date).
  Runs serialise per schedule (a running run makes the next wait).

## R4. Delivery
- **Decision**: For each recipient: 008 WhatsApp `report_ready` template with document
  attachment (≤ 100 MB; larger → email link only + WhatsApp text) and email with attachment
  (≤ 20 MB; larger → signed link valid 7 days). Retries and logging come from 008.

## R5. Scoping
- **Decision**: `scope(user)` returns warehouse ids / event ids; every query has a mandatory
  `WHERE` on scope (Admins: none). Managers cannot create schedules.

## R6. Dashboard
- **Decision**: One endpoint returning counts computed by indexed queries; client polls every
  60 s and refreshes on relevant in-app notifications.
