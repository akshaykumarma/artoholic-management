# Implementation Plan: Event Planning & Reservations

**Branch**: `005-event-planning` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-event-planning/spec.md`

## Summary

Events with venue, dates, managers and lines sourced from warehouses or (direct handover) from an
earlier event; availability per item/warehouse over the event's date window; reservations as
ledger movements; over-booking allowed with a warning to the event's Admins, Event Managers and
Store Managers that clears automatically; copy-as-template; status Draft/Scheduled/Cancelled
(006 drives the rest); list, calendar and Today views; reminders. Decisions:
[research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001

**Primary Dependencies**: 001–004 stack; pg-boss scheduled jobs (reminders, availability
re-evaluation); Google Maps Places (venue)

**Storage**: PostgreSQL — `events`, `event_assignments`, `event_lines`, `event_line_sources`,
`overbooking_warnings`, `event_types`

**Testing**: Vitest — availability over overlapping windows (touching days overlap), reservation
deltas on edit, cancel release, handover-source eligibility, warning raise/clear, optimistic
concurrency; contract tests; Playwright create/copy/cancel; jest-expo Today view

**Performance Goals**: Line availability ≤ 1 s (SC-002); warning fan-out ≤ 2 min (SC-003);
calendar month ≤ 1 s

**Constraints**: Reservations always equal Scheduled events' planned quantities (SC-005,
nightly check); only Admins mutate events; managers see assigned events only

**Scale/Scope**: 1,000 events/year, ≤ 200 lines per event

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Availability and over-booking math, reservation deltas, state transitions, handover rules tested first; boundary cases for same-day overlap. | Pass |
| II. Ledger | Reservations are `reserve`/`release` movements via `postMovements()`; handover-sourced lines reserve nothing new (stock stays reserved/out on the giving event). | Pass |
| III. One API contract | `/api/v1/events/*` shared schemas; `If-Match` concurrency; contract tests. | Pass |
| IV. Field-first mobile | Today view and event detail on phone; Admin create on phone supported. | Pass |
| V. Security & audit | `requireEventAssignment` for managers; audit with before/after; warnings logged. | Pass |
| VI. Simplicity | Availability computed on demand from balances + reservations; no separate calendar engine. | Pass |
| Domain constraints | State machine enumerable (shared `EventStatus`); over-booking warns per constitution. | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/005-event-planning/ (plan, research, data-model, quickstart, contracts/api-events.md)

packages/shared/src/contracts/events.ts
packages/shared/src/events/{status,window}.ts     # state machine, IST date-window helpers
apps/web/server/events/        # create/edit/cancel/copy, reservations, availability, warnings
apps/web/server/jobs/events/   # reminders, nightly reservation check, re-evaluate warnings
apps/web/app/api/v1/events/…
apps/web/app/(shell)/events/…  # list, calendar, today, form, detail
apps/mobile/app/(shell)/events/…
```

## Complexity Tracking

No violations.
