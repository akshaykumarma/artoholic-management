# Implementation Plan: Catalogue & Inventory

**Branch**: `003-catalogue-inventory` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-catalogue-inventory/spec.md`

## Summary

Build the catalogue (categories, units, items with three tracking types, editable codes with
history, photos) and the append-only stock ledger that every later feature writes to: movements
with typed from/to (location, condition), derived balances, cut-product pieces with offcuts,
Admin-approved corrections and write-offs, item view, search, low-stock alerts and Excel/CSV
import with dry run. Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: As 001

**Primary Dependencies**: 001 stack plus `exceljs` (xlsx read/write), `csv-parse`,
`pg_trgm` extension (search), `expo-image-manipulator` (photo compression on device),
`@aws-sdk/s3-request-presigner` (direct photo upload)

**Storage**: PostgreSQL (`numeric(14,3)` quantities, `bigint` paise); S3-compatible bucket
`item-photos` (kept forever)

**Testing**: Vitest — ledger invariants (no negative balance, rebuild = cached), concurrency on
the same item/location, unit conversion, cut/offcut arithmetic, import dry run; contract tests;
Playwright item CRUD + import; jest-expo item view

**Target Platform / Project Type**: As 001

**Performance Goals**: Item view ≤ 2 s on phone 4G (SC-003); search ≤ 1 s at 10,000 items
(SC-004); posting a movement ≤ 300 ms p95; 5,000-row import ≤ 60 s

**Constraints**: Ledger rows never updated/deleted (DB role has no UPDATE/DELETE on
`stock_movements`); balances only via `postMovements()`; tracking type immutable after first
movement

**Scale/Scope**: 10,000 items, 500,000 movements over 3 years; ~10 screens per app

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Ledger invariants, negative-stock refusal, correction approval flow, cut arithmetic, conversion and import tested before code. | Pass |
| II. Ledger is the source of truth | Single `postMovements(tx, movements[])` service is the only writer of `stock_movements` and `stock_balances`; balances rebuildable by a nightly check job; corrections reference originals. | Pass |
| III. One API contract | `/api/v1/catalogue/*`, `/api/v1/stock/*` with shared zod schemas and contract tests. | Pass |
| IV. Field-first mobile | Photos compressed on device; stock views and correction requests on phone; search-as-you-type. | Pass |
| V. Security & audit | Store Manager scope via `requireWarehouseScope`; every catalogue change audited; photo URLs signed, short-lived. | Pass |
| VI. Simplicity | One movements table with typed columns instead of per-type tables; balances as one cached table. | Pass |
| Service levels | Retention: item photos forever (Q12). | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/003-catalogue-inventory/
├── plan.md · research.md · data-model.md · quickstart.md
└── contracts/api-catalogue-stock.md

packages/shared/src/
├── contracts/{catalogue,stock}.ts
└── inventory/{conditions,units,quantity}.ts   # condition enum, conversion, decimal-string math
apps/web/
├── db/schema.ts            # categories, units, items, item_codes, item_photos, item_pieces,
│                           # locations (default per warehouse), stock_movements, stock_balances,
│                           # correction_requests, import_batches
├── server/catalogue/       # categories, units, items, codes, photos
├── server/stock/           # postMovements, reserve/release/move API for 005–007, corrections,
│                           # write-offs, cuts, low-stock detector, balance rebuild check
├── server/imports/         # parse, validate (dry run), commit
├── app/api/v1/catalogue/…  · app/api/v1/stock/…
└── app/(shell)/inventory/… # categories, units, items list, item view, import
apps/mobile/app/(shell)/inventory/  # item list, item view, cut, correction request, photo capture
```

**Structure Decision**: 001 layout. `server/stock` exposes the internal service API that 004–007
call; no other module writes stock tables.

## Complexity Tracking

No violations.
