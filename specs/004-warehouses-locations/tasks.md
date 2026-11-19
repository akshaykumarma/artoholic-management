---
description: "Task list for 004-warehouses-locations"
---

# Tasks: Warehouses & Locations

**Input**: `specs/004-warehouses-locations/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–003 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Add Google Maps Places key config to `.env.example` (`MAPS_API_KEY_WEB`) and a `MapPinPicker` component placeholder in `apps/web/components/MapPinPicker.tsx`

## Phase 2: Foundational

- [ ] T002 Migration: extend `warehouses`, `locations`; add `warehouse_levels`, `transfers`, `transfer_lines`; add `in_transit` condition; FK from 002 `warehouse_assignments` in `apps/web/db/schema.ts`
- [ ] T003 [P] Location code builder + range expansion + padding with tests in `packages/shared/src/warehouses/location-code.ts`, `packages/shared/tests/location-code.test.ts`
- [ ] T004 [P] zod schemas `packages/shared/src/contracts/{warehouses,transfers}.ts`
- [ ] T005 Bin-only rule in `apps/web/server/stock/post.ts` (default location allowed only until the warehouse has bins) with tests in `apps/web/tests/integration/bins-only.test.ts`

## Phase 3: US1 — Admin sets up a warehouse and its layout (P1) 🎯 MVP

- [ ] T006 [P] [US1] Tests: code format/uniqueness/immutability, 1–5 levels, level count locked once locations exist, SM visibility by assignment in `apps/web/tests/integration/warehouses.test.ts`
- [ ] T007 [P] [US1] Contract tests `/api/v1/warehouses` in `apps/web/tests/contract/warehouses.test.ts`
- [ ] T008 [US1] Service `apps/web/server/warehouses/warehouses.ts`; routes `apps/web/app/api/v1/warehouses/route.ts`, `…/[id]/route.ts`
- [ ] T009 [P] [US1] Screens `apps/web/app/(shell)/warehouses/…`, `apps/mobile/app/(shell)/warehouses/…`; enable warehouse picker in 002 user form `apps/web/app/(shell)/users/new/page.tsx`
- [ ] T010 [US1] Mark `warehouses` module shipped in `packages/shared/src/modules/index.ts`

## Phase 4: US2 — Create bins singly or in bulk (P1)

- [ ] T011 [P] [US2] Tests: preview counts, skip existing, ≤ 2,000 per request, padding in `apps/web/tests/integration/locations-bulk.test.ts`
- [ ] T012 [US2] Service `apps/web/server/warehouses/locations.ts`; routes `…/[id]/locations/route.ts`, `…/[id]/locations/bulk/preview/route.ts`, `…/[id]/locations/bulk/route.ts`
- [ ] T013 [P] [US2] Bulk form with preview `apps/web/app/(shell)/warehouses/[id]/locations/bulk/page.tsx`; tree browser `apps/web/app/(shell)/warehouses/[id]/locations/page.tsx`

## Phase 5: US3 — Put away and move stock between bins (P1)

- [ ] T014 [P] [US3] Tests: move splits balances in one movement, over-quantity refused, default-location migration in `apps/web/tests/integration/moves.test.ts`
- [ ] T015 [US3] Move service `apps/web/server/warehouses/moves.ts`; routes `apps/web/app/api/v1/stock/moves/route.ts`, `apps/web/app/api/v1/warehouses/[id]/bin-suggestions/route.ts`
- [ ] T016 [P] [US3] Mobile move screen with bin picker (partial code, usual bins first) `apps/mobile/app/(shell)/warehouses/move.tsx`, shared `apps/mobile/src/components/BinPicker.tsx`

## Phase 6: US4 — Transfers between warehouses (P2)

- [ ] T017 [P] [US4] Tests: state machine, in-transit excluded from available, shortfall decisions lost/returned, cancel only when requested in `apps/web/tests/integration/transfers.test.ts`
- [ ] T018 [P] [US4] Contract tests `/api/v1/transfers` in `apps/web/tests/contract/transfers.test.ts`
- [ ] T019 [US4] Service `apps/web/server/transfers/transfers.ts` (TRF numbers via 001 sequences); routes under `apps/web/app/api/v1/transfers/`
- [ ] T020 [P] [US4] Screens `apps/web/app/(shell)/transfers/…`, `apps/mobile/app/(shell)/transfers/…`

## Phase 7: US5 — Keep the layout tidy (P3)

- [ ] T021 [P] [US5] Tests: cannot deactivate non-empty bin or warehouse with stock/open references in `apps/web/tests/integration/locations-deactivate.test.ts`
- [ ] T022 [US5] Rename/deactivate in `apps/web/server/warehouses/locations.ts`; route `apps/web/app/api/v1/locations/[id]/route.ts`

## Phase 8: Polish

- [ ] T023 Run quickstart 1–6; record in `specs/004-warehouses-locations/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 → US2 → US3 = MVP; US4 and US5 after.
