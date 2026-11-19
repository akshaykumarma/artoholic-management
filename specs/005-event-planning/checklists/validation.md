# Validation record: 005 Event Planning & Reservations

**Date**: 2026-11-19 · **Branch**: `005-implementation`

## Quickstart scenarios

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Schedule an event with 50 chairs from MAIN | Pass: `EVT-YYYY-0001`; 50 reserved in the bin; overlapping window shows 50 available, a later window 100 | `tests/integration/events.test.ts` (US1) |
| 2 | 100 chairs, 80 on an overlapping event; add 30 to a new event | Pass: "20 available — 10 short" before saving; saved with a banner; `event.overbooking_raised` to Admins, EMs and SMs; listed on the clashing event; over-booked filter | `events.test.ts` (US2); e2e `stock-events.spec.ts` |
| 3 | Reduce the clashing event to 60 | Pass: freed stock tops up the second event's reservation (90 reserved), warning clears, `event.overbooking_resolved` to the same people | `events.test.ts` (US2) |
| 4 | Source event Y's 20 chairs from event X (ends the day before) | Pass: source = X, no new reservation; ineligible source refused (`HANDOVER_NOT_ELIGIBLE`); cancelling X raises a warning on Y | `events.test.ts` (handover) |
| 5 | Edit 50 → 40, then cancel | Pass: reserved 40, then 0; assignees told; cancel after dispatch refused (`EVENT_STATE`) | `events.test.ts` (US4) |
| 6 | Two Admins save the same event | Pass: second gets `EVENT_CHANGED` with the current version | `events.test.ts` (US4) |
| 7 | Store Manager opens Today | Pass: only today's dispatches for their warehouses | `events.test.ts` (US5); mobile `events.test.tsx` |
| 8 | Nightly reservation check | Pass: zero mismatches | `events.test.ts` (SC-005) |

Also covered: the missing-fields list on scheduling (`EVENT_INCOMPLETE`); date rules; Store Manager suggestion and the warning
on lines with no Store Manager; one `event.scheduled` per assignee; `event.changed` with the changed fields; `event.unassigned`;
copy as a Draft; the 24-hour dispatch reminder, sent once.

## Checks

- Shared 58/58, web integration and contract 241/241, mobile 23/23, Playwright e2e 10/10.
- Typecheck and lint clean (exit code 0).

## Decisions made during implementation

- **Who gets the warning when two events clash**: the event scheduled first keeps its stock, and the warning goes to the later
  one (spec scenario: "80 reserved by an overlapping event; add 30 → 10 short" on the new event). Recorded in `events.scheduled_at`.
- **Physical reservation vs window availability**: reservations move real stock (available → reserved) in the source warehouse's
  bins. Warnings use window availability (research R2). A sweep every 2 minutes tops up reservations as stock arrives and
  re-evaluates warnings (SC-004).
- **Notifications**: written to `notification_outbox` with `recipientIds`; delivery (in-app, push, WhatsApp) comes with 008.
- **Venue pin**: entered as coordinates for now; Places search arrives with the Maps key, as for warehouses (004).
