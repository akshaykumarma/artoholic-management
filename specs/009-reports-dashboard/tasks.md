---
description: "Task list for 009-reports-dashboard"
---

# Tasks: Reports & Admin Dashboard

**Input**: `specs/009-reports-dashboard/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–008 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `expo-sharing`, `expo-file-system` to mobile; bucket `reports` with 90-day lifecycle in `docker-compose.yml` bootstrap

## Phase 2: Foundational

- [X] T002 Migration: `report_schedules`, `report_schedule_recipients`, `report_runs` in `apps/web/db/schema.ts`
- [X] T003 [P] Report registry (ids, titles, filters, typed columns) `packages/shared/src/reports/registry.ts`; schemas `packages/shared/src/contracts/reports.ts`
- [X] T004 [P] Seeded ledger fixture used by all report tests `apps/web/tests/fixtures/reports-seed.ts`
- [X] T005 Runner (scope, paging) `apps/web/server/reports/{run,scope}.ts`; xlsx streaming writer with header rows and formats `apps/web/server/reports/xlsx.ts` with tests `apps/web/tests/integration/xlsx.test.ts`

## Phase 3: US1 — Run any report on demand (P1) 🎯 MVP

- [X] T006 [P] [US1] Expected-output tests per report R1–R10 against the fixture in `apps/web/tests/integration/reports/R{1..10}.test.ts`
- [X] T007 [P] [US1] Scoping tests (SM warehouses, EM events) in `apps/web/tests/integration/reports-scope.test.ts`
- [X] T008 [US1] Queries `apps/web/server/reports/queries/R1.ts` … `R10.ts`
- [X] T009 [US1] Routes `apps/web/app/api/v1/reports/{route,[reportId]/run/route,[reportId]/export/route,runs/[runId]/route}.ts`
- [X] T010 [P] [US1] Report screens `apps/web/app/(shell)/reports/…`, `apps/mobile/app/(shell)/reports/…` (view + share xlsx); mark `reports` module shipped

## Phase 4: US2 — Schedules to WhatsApp and email (P1)

- [X] T011 [P] [US2] Tests: Admin-only recipients (`RECIPIENT_NOT_ADMIN`), month-end clamp, serialised runs, empty-report row, size fallbacks, delivery logging via 008 in `apps/web/tests/integration/report-schedules.test.ts`
- [X] T012 [US2] Schedule service + runner job `apps/web/server/reports/schedules.ts`, `apps/web/server/jobs/reports/run-due.ts`; emit `report.ready` with document
- [X] T013 [US2] Routes `apps/web/app/api/v1/report-schedules/{route,[id]/route,[id]/runs/route}.ts`; screens `apps/web/app/(shell)/reports/schedules/…`

## Phase 5: US3 — Admin dashboard (P2)

- [X] T014 [P] [US3] Contract test `GET /api/v1/dashboard` in `apps/web/tests/contract/dashboard.test.ts`
- [X] T015 [US3] Dashboard queries `apps/web/server/dashboard/index.ts`; route `apps/web/app/api/v1/dashboard/route.ts`
- [X] T016 [P] [US3] Dashboard on Admin home `apps/web/app/(shell)/page.tsx`, `apps/mobile/app/(shell)/index.tsx` (60 s refresh, links to filtered lists)

## Phase 6: Polish

- [X] T017 Performance: 5,000-row report first page ≤ 5 s, Excel ≤ 30 s; run quickstart 1–6; record in `specs/009-reports-dashboard/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 → US2 = MVP; US3 after. R8–R10 may slip to Phase 2 (spec assumption).
