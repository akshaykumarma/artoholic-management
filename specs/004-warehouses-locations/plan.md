# Implementation Plan: Warehouses & Locations

**Branch**: `004-warehouses-locations` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-warehouses-locations/spec.md`

## Summary

Turn 003's minimal warehouse and default location into full warehouses (address, map pin,
contact, Store Managers via 002's assignments) with 1–5 user-named location levels, a location
tree with readable codes, bulk bin creation, bin-to-bin moves, migration out of default
locations, and request → dispatch → receive transfers with in-transit stock and Admin-decided
shortfalls. Decisions: [research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001

**Primary Dependencies**: 001/003 stack; Google Maps Places autocomplete (web) and a
`geo:`/Maps deep link (mobile) for the map pin

**Storage**: PostgreSQL — extends `warehouses`, `locations`; adds `warehouse_levels`,
`transfers`, `transfer_lines`; new movement condition `in_transit`

**Testing**: Vitest — code generation and padding, bulk preview/skip, deactivation guards,
transfer state machine and shortfall decisions; contract tests; Playwright layout setup;
jest-expo move screen

**Performance Goals**: Bulk create 2,000 bins ≤ 5 s; bin picker search ≤ 300 ms; move ≤ 20 s
end-to-end on phone (SC-002)

**Constraints**: All stock in bins (SC-003); in-transit never counted as available (SC-004);
warehouse code immutable once bins exist; level count immutable once locations exist

**Scale/Scope**: 10 warehouses, 20,000 locations

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Code builder, bulk preview, guards, transfer transitions and shortfall postings tested first. | Pass |
| II. Ledger | Moves, transfers and default-location migration use 003's `postMovements()` (`move`, `transfer_out`, `transfer_in`, `lost`). | Pass |
| III. One API contract | `/api/v1/warehouses/*`, `/api/v1/transfers/*`; shared schemas; contract tests. | Pass |
| IV. Field-first mobile | Bin picker by partial code with usual bins first; move in ≤ 3 taps after item chosen. | Pass |
| V. Security & audit | `requireWarehouseScope` for Store Managers; audit on every change. | Pass |
| VI. Simplicity | Location tree as adjacency list with materialised `code`; no spatial model. | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/004-warehouses-locations/ (plan, research, data-model, quickstart, contracts/api-warehouses.md)

packages/shared/src/contracts/{warehouses,transfers}.ts
packages/shared/src/warehouses/location-code.ts      # code builder + padding (shared for preview)
apps/web/server/warehouses/   # warehouses, levels, locations, bulk, moves, default migration
apps/web/server/transfers/    # state machine, shortfall decisions
apps/web/app/api/v1/{warehouses,transfers}/…
apps/web/app/(shell)/warehouses/… · (shell)/transfers/…
apps/mobile/app/(shell)/warehouses/… · (shell)/transfers/…
```

**Structure Decision**: 001 layout; stock changes only through `server/stock`.

## Complexity Tracking

No violations.
