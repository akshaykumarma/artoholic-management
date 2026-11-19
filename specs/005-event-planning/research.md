# Research: 005-event-planning

## R1. Date window and overlap
- **Decision**: Window = [leave-warehouse date, expected return date] as IST calendar dates,
  inclusive. Two windows overlap if `a.start ≤ b.end AND b.start ≤ a.end` (touching days
  overlap, spec edge case).

## R2. Availability
- **Decision**: For item i, warehouse w, window W:
  `available = on-hand-in-bins(i,w) − Σ reserved for Scheduled events at w whose window overlaps W
  (excluding this event) − Σ out at events whose window overlaps W`.
  Physical stock can be Available now but committed to an overlapping future event; the formula
  uses window-scoped commitments, not just today's `reserved` condition. Computed in one SQL
  query per line set.
- **Alternatives**: Day-by-day capacity table (needless at this scale).

## R3. Reservations as movements
- **Decision**: Scheduling posts `reserve` (available → reserved, same bin, reference
  `event_line`) using the warehouse's bins in walking order; edits post the delta (`reserve` or
  `release`); cancel releases all. If physical available stock is short, the reservation takes
  what exists and the remainder is the over-booking shortfall (stock arriving later is reserved by
  the re-evaluation job).

## R4. Over-booking warnings
- **Decision**: `overbooking_warnings` per line with shortfall and clashing event ids. Raised on
  save; re-evaluated by a job triggered on any movement or event change affecting the item and
  warehouse (debounced 30 s) plus hourly sweep; resolved warnings set `resolved_at` and notify
  the same people (008 trigger `event.overbooking_*`).

## R5. Direct handover sourcing (clarification)
- **Decision**: `event_line_sources` row with `source_type = 'event'`, `source_event_id`.
  Eligible if source event's end ≤ this event's leave-warehouse date-time and the source has a
  line for the item with enough planned quantity not already promised to another handover.
  Changes on the source that break the fit raise a warning on the receiving event.

## R6. Concurrency
- **Decision**: `events.version` integer; PATCH requires `If-Match`; mismatch → `409
  EVENT_CHANGED` with the current version.

## R7. Reminders
- **Decision**: pg-boss cron per minute finds due reminders (dispatch: 24 h before leave time if
  dispatch not submitted; return: 09:00 IST on expected return date if return not dispatched;
  over-booked: 08:00 IST on leave date) with an idempotency key per event/kind/day.
