# Research: 006-event-checklists

## R1. Step → movement mapping
| Step | Entry fields | Movements posted on submit |
| --- | --- | --- |
| Warehouse dispatch (per warehouse) | dispatched qty, pieces, short reason; transport (one set) | `dispatch`: reserved@bin → out@event; unreserved shortfall `release` |
| Site receipt | received, damaged (+photos), missing (computed, confirmed) | none for good stock (stays out); damage report created per damaged/missing line (no movement until decided) |
| Return dispatch | returned, handed over (to event), consumed, damaged (+photos), remaining length | `consume`: out → consumed; handover: `handover` out@X → out@Y; damage report for damaged |
| Warehouse receipt (per warehouse) | received, damaged (+photos), bin | `return`: out@event → available@bin; shortfall → missing report |
| Admin decision | approve / reject | approve damaged: counts as `damaged_approved`; reported at warehouse receipt → `damage` movement out@event → damaged@bin at once, reported earlier → the item moves to damaged@bin when it is received back; approve missing: `lost` movement out@event → lost; reject: entry reopened |

Damaged stock at site stays `out` (condition flag on the report) until it physically returns;
on warehouse receipt it is placed as `damaged@bin`.

## R2. Reconciliation
- **Decision**: Per line per source: `returned + handed_over + damaged_approved + lost_approved +
  consumed = dispatched`; implemented once in `packages/shared/src/events/reconcile.ts` and used
  by server gate and UI badges.

## R3. Drafts and submission
- **Decision**: Entries saved continuously to `DraftStore` (device) and, when online, to the
  server as `in_progress` entries every 10 s (so a second device sees progress). Submit sends the
  full table with the step's `version`; second submission → `409 STEP_ALREADY_SUBMITTED`.
  One submission per step (clarification B).

## R4. Photos
- **Decision**: Capture with `expo-camera`; compress to longest side 1600 px JPEG q0.8 and burn a
  stamp (date-time IST + event number) with `expo-image-manipulator`; upload via presigned PUT
  from a persistent queue with exponential retry; entry references photo keys, submission waits
  only for keys of damaged lines.

## R5. Damage decisions
- **Decision**: `damage_reports.status` changes with `UPDATE … WHERE status='pending'` returning
  the row; zero rows → `409 ALREADY_DECIDED` (US3-3). Numbered `DMG-YYYY-NNNNN`.

## R6. Status advance
- **Decision**: Derived after each submission in the same transaction from step states across
  rounds: any dispatch submitted → dispatching; all round-1 dispatches → in_transit; site receipt
  → at_site; return dispatch → returning; all warehouse receipts → reconciling. Later rounds do
  not move the status backwards.

## R7. Closed-event corrections
- **Decision**: `event_corrections` row + `correction` movement(s) referencing the original
  movement; line quantities recomputed; activity log shows old → new.

## R8. Rendering 200 lines on phones
- **Decision**: `FlashList` virtualised rows, fixed row height, numeric keypad inputs, sticky
  filter bar; target 60 fps on mid-range Android.
