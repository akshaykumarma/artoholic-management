# Implementation Plan: Event Checklists, Damage Approval & Closure

**Branch**: `006-event-checklists` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-event-checklists/spec.md`

## Summary

The four checklist steps per dispatch round — warehouse dispatch, site receipt, return dispatch
(with direct handover to another event), warehouse receipt — each submitted once for the event
(per warehouse for warehouse steps), with device-side drafts, photo evidence, damage reports
decided by any Admin, automatic status advance, reconciliation-gated closure, closed-event
corrections and extra dispatch rounds. Every quantity change goes through 003's ledger.
Decisions: [research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001

**Primary Dependencies**: 001–005 stack; `expo-camera`/`expo-image-picker`,
`expo-image-manipulator` (compress + stamp), `expo-location` (optional GPS),
`@react-native-async-storage/async-storage` drafts (001 `DraftStore`)

**Storage**: PostgreSQL — `dispatch_rounds`, `checklist_steps`, `checklist_entries`,
`damage_reports`, `damage_photos`, `handovers`, `event_corrections`; bucket `damage-photos`
(deleted 6 months after decision by 010)

**Testing**: Vitest — every step's movements, reconciliation formula incl. handover, damage
approve/reject, single decision under concurrency, status advance, closure gate, closed-event
correction; contract tests; Playwright full lifecycle; jest-expo kill-mid-entry draft recovery
(SC-005) and 200-line table render (SC-006)

**Performance Goals**: 200-line checklist opens ≤ 2 s; step submit ≤ 2 s p95 for 200 lines;
photo upload ≤ 5 s on 4G with retry

**Constraints**: Drafts never lost; one submission per step (clarification B); damage photos
required; any Admin decides once

**Scale/Scope**: ≤ 200 lines × 4 steps per round; ~5 damage reports per event

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Reconciliation (returned + handed over + damaged + lost + consumed = dispatched), every movement mapping, closure gate, concurrent decisions tested first. | Pass |
| II. Ledger | Step submissions call `postMovements()` only; corrections to closed events are `correction` movements referencing originals. | Pass |
| III. One API contract | `/api/v1/events/{id}/rounds/*`, `/api/v1/damage-reports/*`; shared schemas; contract tests. | Pass |
| IV. Field-first mobile | Virtualised table, filter "not done", search; drafts in `DraftStore` keyed by step; photos compressed and stamped on device; upload queue with retry; GPS optional. | Pass |
| V. Security & audit | Step permissions by role on the event; audit with device/GPS; damage photos via signed URLs. | Pass |
| VI. Simplicity | One `checklist_entries` table for all four steps; truckloads not modelled (clarification B). | Pass |
| Service levels | Photo retention per Q12 (job in 010). | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/006-event-checklists/ (plan, research, data-model, quickstart, contracts/api-checklists.md)

packages/shared/src/contracts/{checklists,damage}.ts
packages/shared/src/events/reconcile.ts       # formula + per-line status, used by both apps
apps/web/server/checklists/   # steps, submissions → movements, status advance, rounds, handover
apps/web/server/damage/       # reports, decisions
apps/web/server/events/closure.ts · corrections.ts
apps/web/app/api/v1/events/[id]/rounds/… · app/api/v1/damage-reports/…
apps/web/app/(shell)/events/[id]/checklists/… · (shell)/approvals/…
apps/mobile/app/(shell)/events/[id]/checklist/[step].tsx
apps/mobile/src/photos/        # capture, compress, stamp, upload queue
```

## Complexity Tracking

No violations.
