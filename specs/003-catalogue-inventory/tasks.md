---
description: "Task list for 003-catalogue-inventory"
---

# Tasks: Catalogue & Inventory

**Input**: `specs/003-catalogue-inventory/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001, 002 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `exceljs`, `csv-parse`, `decimal.js`, `@aws-sdk/s3-request-presigner` to the workspaces; `expo-image-manipulator` to mobile; enable `pg_trgm` in a migration

## Phase 2: Foundational (the ledger — blocks every story)

- [X] T002 Schema + migration `apps/web/db/migrations/0002_catalogue_inventory.sql`: categories, units, items, item_codes, item_photos, item_pieces, minimal warehouses + default locations, stock_movements (append-only trigger), stock_balances (CHECK ≥ 0), correction_requests, import_batches, notification_outbox
- [X] T003 [P] Condition enum, on-hand rule and decimal quantity math in `packages/shared/src/inventory/{conditions,quantity}.ts` with tests `packages/shared/tests/quantity.test.ts`
- [X] T004 [P] Ledger invariant tests: no negative balance, parallel debits (one refused), deterministic lock order, rebuild equals cache in `apps/web/tests/integration/ledger.test.ts`
- [X] T005 `postMovements(tx, movements[])` (sole writer of movements and balances) in `apps/web/server/stock/post.ts`
- [X] T006 [P] Nightly balance rebuild check job `apps/web/server/jobs/stock-rebuild-check.ts`
- [X] T007 [P] zod schemas `packages/shared/src/contracts/{catalogue,stock}.ts`
- [X] T008 [P] Presigned photo upload helper `apps/web/server/storage/presign.ts`; mobile compress+upload `apps/mobile/src/photos/upload.ts`

## Phase 3: US1 — Admin builds the catalogue (P1) 🎯 MVP

- [X] T009 [P] [US1] Tests: unit required per tracking type, auto/typed codes, code change history + all-codes uniqueness, archive-not-delete, unit conversion within family in `apps/web/tests/integration/catalogue.test.ts`
- [X] T010 [P] [US1] Contract tests for categories, units, items endpoints in `apps/web/tests/contract/catalogue.test.ts`
- [X] T011 [US1] Services `apps/web/server/catalogue/{categories,units,items,codes,photos}.ts`
- [X] T012 [US1] Routes under `apps/web/app/api/v1/catalogue/` (categories, units, items, items/[id], items/[id]/photos)
- [X] T013 [P] [US1] Web screens `apps/web/app/(shell)/inventory/{categories,units,items}/…`
- [X] T014 [P] [US1] Mobile item list `apps/mobile/app/(shell)/inventory/index.tsx` and item page `[id].tsx` (creating items stays on the web for Admins)
- [X] T015 [US1] Mark `inventory` module shipped in `packages/shared/src/modules/index.ts`

## Phase 4: US2 — Load opening stock and see what we have (P1)

- [X] T016 [P] [US2] Tests: import dry run lists row errors, commit blocked with errors, commit posts `opening` movements referencing the batch, ≤ 5,000 rows in `apps/web/tests/integration/imports.test.ts`
- [X] T017 [US2] Import parse/validate/commit in `apps/web/server/imports/{parse,validate,commit}.ts`; templates generator `apps/web/server/imports/templates.ts`
- [X] T018 [US2] Routes `apps/web/app/api/v1/imports/route.ts`, `…/[id]/commit/route.ts`, `…/templates/[kind]/route.ts`, `apps/web/app/api/v1/stock/opening/route.ts`
- [X] T019 [P] [US2] Import screen with preview `apps/web/app/(shell)/inventory/import/page.tsx`

## Phase 5: US3 — Every stock change is in the ledger (P1)

- [X] T020 [P] [US3] Tests: no edit/delete path, corrections reference originals, Store Manager correction pending until Admin approval, Admin correction immediate, reasons required in `apps/web/tests/integration/corrections.test.ts`
- [X] T021 [US3] Correction requests service `apps/web/server/stock/corrections.ts`; routes `apps/web/app/api/v1/stock/corrections/route.ts`, `…/requests/[id]/{approve,reject}/route.ts`, `apps/web/app/api/v1/stock/movements/route.ts`
- [X] T022 [P] [US3] Ledger history view + correction request form (web and mobile) `apps/web/app/(shell)/inventory/items/[id]/history/page.tsx`, `apps/mobile/app/(shell)/inventory/[id]/correct.tsx`; approvals list `apps/web/app/(shell)/approvals/stock/page.tsx`

## Phase 6: US4 — Cut products piece by piece (P1)

- [X] T023 [P] [US4] Tests: cut creates child piece and keeps offcut, total unchanged, piece numbering, below-minimum flag, write-off needs approval in `apps/web/tests/integration/cuts.test.ts`
- [X] T024 [US4] Cut service `apps/web/server/stock/cuts.ts`; route `apps/web/app/api/v1/stock/cuts/route.ts`
- [X] T025 [P] [US4] Cut screen on mobile `apps/mobile/app/(shell)/inventory/[id]/cut.tsx` and pieces table on web item view

## Phase 7: US5 — Item view (P2)

- [X] T026 [P] [US5] Contract test for item view payload (balances by condition/location, pieces, lastUsedIn, reservations, damage summary) in `apps/web/tests/contract/item-view.test.ts`
- [X] T027 [US5] Item view query `apps/web/server/catalogue/item-view.ts` (≤ 2 s target)
- [X] T028 [P] [US5] Item view screens `apps/web/app/(shell)/inventory/items/[id]/page.tsx`, `apps/mobile/app/(shell)/inventory/[id].tsx`

## Phase 8: US6 — Write off or put back damaged stock (P2)

- [X] T029 [P] [US6] Tests in `apps/web/tests/integration/write-offs.test.ts`
- [X] T030 [US6] Routes `apps/web/app/api/v1/stock/write-offs/route.ts`, `apps/web/app/api/v1/stock/return-to-available/route.ts` using `server/stock/corrections.ts`

## Phase 9: US7 — Find items and spot low stock (P3)

- [X] T031 [P] [US7] Tests: trigram search on name and former codes ≤ 1 s at 10k seeded items; low-stock alert once per downward crossing in `apps/web/tests/integration/search-lowstock.test.ts`
- [X] T032 [US7] Search query + filters in `apps/web/server/catalogue/items.ts` (`listItems`); low-stock detector in `apps/web/server/stock/post.ts` emitting `stock.low` to the notification outbox (delivered by 008)

## Phase 10: Polish

- [X] T033 [P] Internal service API for 004–007 (`reserve`, `release`, `move`, `balancesFor`) documented in `apps/web/server/stock/index.ts`
- [X] T034 Run quickstart 1–8; record in `specs/003-catalogue-inventory/checklists/validation.md`

## Dependencies & Strategy

Phase 2 (ledger) blocks everything. US1 → US2 → US3 → US4 are the MVP slice; US5–US7 after.
