---
description: "Task list for 007-physical-count"
---

# Tasks: Physical Counts & Stock Adjustments

**Input**: `specs/007-physical-count/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–006 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Register count jobs (07:00 IST creation, overdue escalation) in `apps/web/server/jobs/boss.ts`

## Phase 2: Foundational

- [X] T002 Migration: `count_schedules`, `count_schedule_scope`, `count_schedule_assignees`, `count_sessions`, `count_lines` in `apps/web/db/schema.ts`
- [X] T003 [P] Next-due-date computation (month-end clamp, anchor day, pause/resume) with tests in `packages/shared/src/counts/schedule.ts`, `packages/shared/tests/count-schedule.test.ts`
- [X] T004 [P] zod schemas `packages/shared/src/contracts/counts.ts`

## Phase 3: US1 — Schedule regular counts (P1) 🎯 MVP

- [X] T005 [P] [US1] Contract tests `/api/v1/counts/schedules` in `apps/web/tests/contract/count-schedules.test.ts`
- [X] T006 [US1] Schedule service `apps/web/server/counts/schedules.ts`; routes `apps/web/app/api/v1/counts/schedules/route.ts`, `…/[id]/route.ts`
- [X] T007 [P] [US1] Schedule screens `apps/web/app/(shell)/counts/schedules/…`; mark `counts` module shipped

## Phase 4: US2 — Sessions appear and assignees are told (P1)

- [X] T008 [P] [US2] Tests: one session per due date (idempotent), snapshot of in-bin balances with `snapshot_movement_id`, ad hoc sessions, CNT numbers in `apps/web/tests/integration/count-sessions.test.ts`
- [X] T009 [US2] Session creation `apps/web/server/counts/sessions.ts`; job `apps/web/server/jobs/counts/create-due.ts`; route `apps/web/app/api/v1/counts/sessions/route.ts`; emit `count.due`

## Phase 5: US3 — Count on the phone (P1)

- [X] T010 [P] [US3] Tests: blind sheet omits recorded quantities for counters, add found item, event-movement flag, `UNCOUNTED_LINES` needs confirm in `apps/web/tests/integration/count-sheet.test.ts`
- [X] T011 [US3] Sheet, entries and submit in `apps/web/server/counts/sheet.ts`; routes `…/sessions/[id]/sheet/route.ts`, `…/entries/route.ts`, `…/submit/route.ts`
- [X] T012 [P] [US3] Mobile count sheet with DraftStore `apps/mobile/app/(shell)/counts/[sessionId].tsx`; jest-expo draft test `apps/mobile/tests/count-sheet.test.tsx`

## Phase 6: US4 — Review variances and approve adjustments (P1)

- [X] T013 [P] [US4] Tests: variance qty and ₹, matched lines auto, approval posts adjustment ignoring post-snapshot movements, `ADJUSTMENT_NEGATIVE`, reject → recount, completion in `apps/web/tests/integration/count-decisions.test.ts`
- [X] T014 [US4] Review + decisions `apps/web/server/counts/review.ts`; routes `…/sessions/[id]/review/route.ts`, `apps/web/app/api/v1/counts/lines/[lineId]/{approve,reject}/route.ts`
- [X] T015 [P] [US4] Review screen sorted by ₹ impact `apps/web/app/(shell)/counts/[sessionId]/review/page.tsx`

## Phase 7: US5 — Missed counts escalated (P2)

- [X] T016 [P] [US5] Tests in `apps/web/tests/integration/count-escalation.test.ts`
- [X] T017 [US5] Escalation job `apps/web/server/jobs/counts/escalate-overdue.ts` emitting `count.overdue`

## Phase 8: Polish

- [X] T018 Run quickstart 1–6; record in `specs/007-physical-count/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 → US2 → US3 → US4 = MVP; US5 after.
