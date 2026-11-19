---
description: "Task list for 005-event-planning"
---

# Tasks: Event Planning & Reservations

**Input**: `specs/005-event-planning/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–004 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Seed event types in a migration and add the Places venue picker reuse from 004 (`apps/web/components/MapPinPicker.tsx`)

## Phase 2: Foundational

- [ ] T002 Migration: `event_types`, `events` (version), `event_assignments`, `event_lines`, `event_line_sources`, `overbooking_warnings` in `apps/web/db/schema.ts`
- [ ] T003 [P] Event status enum + allowed transitions in `packages/shared/src/events/status.ts` with tests `packages/shared/tests/event-status.test.ts`
- [ ] T004 [P] IST date-window helpers (inclusive overlap) in `packages/shared/src/events/window.ts` with tests `packages/shared/tests/event-window.test.ts`
- [ ] T005 [P] zod schemas `packages/shared/src/contracts/events.ts`
- [ ] T006 [P] `requireEventAssignment(user, eventId)` guard in `apps/web/server/auth/guards.ts` with tests

## Phase 3: US1 — Create an event and reserve items (P1) 🎯 MVP

- [ ] T007 [P] [US1] Tests: required fields to schedule, date rules, number at creation, warehouse suggestion, split lines, reservation movements via `postMovements`, SM suggestion in `apps/web/tests/integration/events-create.test.ts`
- [ ] T008 [P] [US1] Contract tests `POST/GET/PATCH /api/v1/events`, `/schedule` in `apps/web/tests/contract/events.test.ts`
- [ ] T009 [US1] Availability query `apps/web/server/events/availability.ts` (research R2) with tests `apps/web/tests/integration/availability.test.ts`
- [ ] T010 [US1] Event service (create/schedule, reservations) `apps/web/server/events/events.ts`, `apps/web/server/events/reservations.ts`
- [ ] T011 [US1] Routes `apps/web/app/api/v1/events/route.ts`, `…/[id]/route.ts`, `…/[id]/schedule/route.ts`, `apps/web/app/api/v1/events/availability/route.ts`
- [ ] T012 [P] [US1] Event form with live availability per line `apps/web/app/(shell)/events/new/page.tsx`; detail `apps/web/app/(shell)/events/[id]/page.tsx`; mobile equivalents `apps/mobile/app/(shell)/events/…`
- [ ] T013 [US1] Mark `events` module shipped in `packages/shared/src/modules/index.ts`

## Phase 4: US2 — Over-booking warning to everyone involved (P1)

- [ ] T014 [P] [US2] Tests: save allowed when short, banner, recipients = event Admins + EMs + SMs, listed on clashing events, auto-clear and resolved notice, leave-date reminder in `apps/web/tests/integration/overbooking.test.ts`
- [ ] T015 [US2] Warning service + debounced re-evaluation job `apps/web/server/events/warnings.ts`, `apps/web/server/jobs/events/reevaluate-warnings.ts` (emit `event.overbooking_raised/resolved`; in-app until 008)
- [ ] T016 [P] [US2] Banner and line shortfall UI on web and mobile event screens

## Phase 5: US3 — Assignees told to start dispatch (P1)

- [ ] T017 [P] [US3] Tests: one notification per assignee on schedule; change diff; removed managers informed in `apps/web/tests/integration/event-notify.test.ts`
- [ ] T018 [US3] Emit `event.scheduled`, `event.changed`, `event.unassigned` from `apps/web/server/events/events.ts`

## Phase 6: Direct handover sourcing (clarification; part of US1 scope)

- [ ] T019 [P] [US1] Tests: eligibility (source ends ≤ leave time, free quantity), no new reservation, source change raises warning on receiver in `apps/web/tests/integration/handover-sources.test.ts`
- [ ] T020 [US1] Handover sources query + validation `apps/web/server/events/handover-sources.ts`; route `apps/web/app/api/v1/events/handover-sources/route.ts`; source picker in event form

## Phase 7: US4 — Edit, cancel, copy (P2)

- [ ] T021 [P] [US4] Tests: reservation deltas on edit, cancel releases and notifies, cancel refused after dispatch, copy → Draft, `EVENT_CHANGED` on stale `If-Match` in `apps/web/tests/integration/events-edit.test.ts`
- [ ] T022 [US4] Edit/cancel/copy in `apps/web/server/events/events.ts`; routes `…/[id]/cancel/route.ts`, `…/[id]/copy/route.ts`

## Phase 8: US5 — See what's coming (P2)

- [ ] T023 [P] [US5] Tests: scoped list, calendar month, Today (IST) for SMs/EMs, over-booked filter in `apps/web/tests/integration/events-views.test.ts`
- [ ] T024 [US5] Queries `apps/web/server/events/views.ts`; routes `apps/web/app/api/v1/events/calendar/route.ts`, `apps/web/app/api/v1/events/today/route.ts`
- [ ] T025 [P] [US5] Screens: list, calendar `apps/web/app/(shell)/events/{page,calendar/page}.tsx`; Today `apps/mobile/app/(shell)/events/today.tsx`

## Phase 9: US6 — Reminders (P3)

- [ ] T026 [P] [US6] Tests: 24 h dispatch reminder, return-date reminder, idempotent per day in `apps/web/tests/integration/event-reminders.test.ts`
- [ ] T027 [US6] Reminder job `apps/web/server/jobs/events/reminders.ts`

## Phase 10: Polish

- [ ] T028 [P] Nightly reservation consistency check `apps/web/server/jobs/events/reservation-check.ts` (SC-005)
- [ ] T029 Run quickstart 1–8; record in `specs/005-event-planning/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 (+ handover sourcing) → US2 → US3 = MVP; US4, US5, US6 after.
