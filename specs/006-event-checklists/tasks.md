---
description: "Task list for 006-event-checklists"
---

# Tasks: Event Checklists, Damage Approval & Closure

**Input**: `specs/006-event-checklists/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–005 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `expo-camera`, `expo-image-picker`, `expo-location`, `@shopify/flash-list` to `apps/mobile`; create bucket `damage-photos` in `docker-compose.yml` bootstrap

## Phase 2: Foundational

- [X] T002 Migration: `dispatch_rounds`, `checklist_steps`, `checklist_entries`, `damage_reports`, `damage_photos`, `handovers`, `event_corrections`; extend `event_lines` running totals in `apps/web/db/schema.ts`
- [X] T003 [P] Reconciliation formula (returned + handed over + damaged + lost + consumed = dispatched) with tests in `packages/shared/src/events/reconcile.ts`, `packages/shared/tests/reconcile.test.ts`
- [X] T004 [P] zod schemas `packages/shared/src/contracts/{checklists,damage}.ts`
- [X] T005 [P] Mobile photo pipeline: capture, compress ≤ 1600 px, stamp IST time + event number, persistent upload queue with retry in `apps/mobile/src/photos/{capture,stamp,queue}.ts` with tests `apps/mobile/tests/photo-queue.test.ts`
- [X] T006 [P] Checklist table component (FlashList, filter "not done", search, numeric inputs, DraftStore autosave) `apps/mobile/src/checklist/ChecklistTable.tsx`; web table `apps/web/components/checklist/ChecklistTable.tsx`
- [X] T007 Step engine: load table (lines by bin), save progress, submit with version and one-submission rule, status advance in `apps/web/server/checklists/steps.ts` with tests `apps/web/tests/integration/steps.test.ts`

## Phase 3: US1 — Warehouse dispatch (P1) 🎯 MVP

- [X] T008 [P] [US1] Tests: reserved → out movements, short reason + Admin notice, over-planned refused, transport fields (one set), per-warehouse submit, Dispatching → In transit in `apps/web/tests/integration/dispatch.test.ts`
- [X] T009 [P] [US1] Contract tests for step GET/progress/submit in `apps/web/tests/contract/steps.test.ts`
- [X] T010 [US1] Dispatch handler `apps/web/server/checklists/dispatch.ts`; routes `apps/web/app/api/v1/events/[id]/rounds/route.ts`, `…/steps/[stepId]/route.ts`, `…/progress/route.ts`, `…/submit/route.ts`
- [X] T011 [P] [US1] Screens `apps/mobile/app/(shell)/events/[id]/checklist/[step].tsx`, `apps/web/app/(shell)/events/[id]/checklists/[stepId]/page.tsx`
- [X] T012 [P] [US1] jest-expo: kill app mid-entry → entries restored (SC-005) in `apps/mobile/tests/checklist-drafts.test.tsx`

## Phase 4: US2 — Site receipt (P1)

- [X] T013 [P] [US2] Tests: photo required for damaged, missing computed + confirmed, damage report per affected line (DMG numbers), At site in `apps/web/tests/integration/site-receipt.test.ts`
- [X] T014 [US2] Site receipt handler `apps/web/server/checklists/site-receipt.ts`; damage report creation `apps/web/server/damage/reports.ts`; photo upload URL route `apps/web/app/api/v1/photos/upload-url/route.ts`

## Phase 5: US3 — Admin reviews damage and loss (P1)

- [X] T015 [P] [US3] Tests: approve → damaged/lost postings per research R1, reject reopens entry, single decision under concurrency (`ALREADY_DECIDED`) in `apps/web/tests/integration/damage-decisions.test.ts`
- [X] T016 [P] [US3] Contract tests `/api/v1/damage-reports` in `apps/web/tests/contract/damage.test.ts`
- [X] T017 [US3] Decision service `apps/web/server/damage/decisions.ts`; routes `apps/web/app/api/v1/damage-reports/route.ts`, `…/[id]/route.ts`, `…/[id]/{approve,reject}/route.ts`
- [X] T018 [P] [US3] Approvals screens (≤ 3 taps on phone) `apps/web/app/(shell)/approvals/damage/…`, `apps/mobile/app/(shell)/approvals/damage/[id].tsx`

## Phase 6: US4 — Return dispatch incl. direct handover (P1)

- [X] T019 [P] [US4] Tests: consumed only for measured/cut, remaining length, damage at return, handover posts `handover` movement and creates the receiving event's receipt step, Returning in `apps/web/tests/integration/return-dispatch.test.ts`
- [X] T020 [US4] Return handler `apps/web/server/checklists/return-dispatch.ts`; handover service `apps/web/server/checklists/handover.ts`

## Phase 7: US5 — Warehouse receipt and put-away (P1)

- [X] T021 [P] [US5] Tests: out → available@bin, missing confirmed → report, cut piece length updated and back in stock, Reconciling in `apps/web/tests/integration/warehouse-receipt.test.ts`
- [X] T022 [US5] Receipt handler `apps/web/server/checklists/warehouse-receipt.ts` (bin default = usual bin)

## Phase 8: US6 — Close the event (P1)

- [X] T023 [P] [US6] Tests: `NOT_RECONCILED` lists blocking lines/reports; close locks steps; notifications in `apps/web/tests/integration/closure.test.ts`
- [X] T024 [US6] Closure `apps/web/server/events/closure.ts`; route `apps/web/app/api/v1/events/[id]/close/route.ts`

## Phase 9: US7 — Correct a closed event (P2)

- [X] T025 [P] [US7] Tests: correction movement referencing original, activity shows old/new/reason in `apps/web/tests/integration/event-corrections.test.ts`
- [X] T026 [US7] Corrections `apps/web/server/events/corrections.ts`; route `apps/web/app/api/v1/events/[id]/corrections/route.ts`; activity route `…/[id]/activity/route.ts`; activity tab on event detail

## Phase 10: US8 — Add items to a live event (P3)

- [X] T027 [P] [US8] Tests: new round reserves and gets its own four steps; status not moved backwards in `apps/web/tests/integration/rounds.test.ts`
- [X] T028 [US8] Round creation in `apps/web/server/checklists/rounds.ts`; POST `…/rounds` route

## Phase 11: Polish

- [X] T029 [P] Playwright full lifecycle (schedule → four steps → damage decisions → close) in `apps/web/tests/e2e/event-lifecycle.spec.ts`
- [X] T030 [P] Performance: 200-line checklist open ≤ 2 s on mid-range Android (SC-006); submit ≤ 2 s p95
- [X] T031 Run quickstart 1–10; record in `specs/006-event-checklists/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 → US2 → US3 → US4 → US5 → US6 is the end-to-end MVP (each step needs
the previous one). US7 and US8 after.
