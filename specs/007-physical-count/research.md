# Research: 007-physical-count

## R1. Due dates
- **Decision**: Next due = start date advanced by frequency (7 days; 1/3/6/12 months) with day
  clamped to month end (31st → 30th/28th…) while keeping the anchor day for later months.
  Paused schedules skip missed periods on resume.

## R2. Session creation and snapshot
- **Decision**: Job at 07:00 IST (pg-boss cron `30 1 * * *` UTC) creates sessions with an
  idempotency key (`schedule_id`, due date). Lines = every (item/piece, bin, condition ∈
  available/reserved/damaged) balance > 0 in scope, plus zero-balance lines for items whose usual
  bin is in scope; `recorded_qty` stored with `snapshot_movement_id` = max movement id at
  snapshot.

## R3. Adjustment formula
- **Decision**: On approval: `expected_now = recorded_at_snapshot + Σ movements on that
  item/piece/bin/condition with id > snapshot_movement_id`; adjustment = counted − recorded at
  snapshot, posted as a signed `adjustment` (to or from the bin/condition). If applying it would
  make the current balance negative → `409 ADJUSTMENT_NEGATIVE` and the line returns to recount.

## R4. Blind counts
- **Decision**: Count-sheet endpoint omits `recordedQty` and variance fields for counters when
  `blind=true`; Admin review endpoint includes them.

## R5. Multiple counters
- **Decision**: Entries saved per line with `updated_by/at`; last write wins; history kept in
  audit.

## R6. Escalation
- **Decision**: Daily 07:00 IST job notifies Admins for sessions with `status=open` and
  `due_date + 3 days ≤ today`.
