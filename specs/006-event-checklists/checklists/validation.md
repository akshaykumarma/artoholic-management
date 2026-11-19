# Validation record: 006 Event Checklists

**Date**: 2026-11-19 · **Branch**: `006-implementation`

## Quickstart scenarios

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Dispatch with vehicle details | Pass: reserved → out; In transit; Event Managers told (`checklist.dispatched`); transport saved with phone normalised | `tests/integration/checklists.test.ts`; e2e `stock-lifecycle.spec.ts` |
| 2 | Dispatch 45 of 50 without a reason | Pass: refused; with a reason, Admins told (`checklist.dispatch_short`) and the unsent 5 released back to Available; over-planned refused | `checklists.test.ts` |
| 3 | Close the app mid-entry, then reopen | Pass: entries restored from the device | mobile `checklist.test.tsx`; web table saves to localStorage |
| 4 | Site receipt: 42 good, 2 damaged with photo, 1 missing | Pass: `PHOTO_REQUIRED` without a photo; `MISSING_NOT_CONFIRMED` until confirmed; `DMG-YYYY-NNNNN` reports to all Admins; At site | `checklists.test.ts` |
| 5 | Two Admins approve the same report | Pass: one 200, the other 409 `ALREADY_DECIDED`; approved damage moves to Damaged in the bin | `checklists.test.ts` |
| 6 | Return dispatch with consumption and a handover | Pass: consumption refused for counted items and allowed for measured; handover moves `out` from X to Y; Y's site receipt waits for it and counts it as dispatch | `checklists.test.ts` (lifecycle, handover) |
| 7 | Warehouse receipt 40 of 41 | Pass: 40 to Available in the chosen bin; 1 missing report; Reconciling | `checklists.test.ts` |
| 8 | Close with a pending report | Pass: `NOT_RECONCILED` lists it; after the decision → Closed; assignees told | `checklists.test.ts`; e2e |
| 9 | Correct a closed event's returned 40 → 39 | Pass: correction movement references the original; line shows 39; activity shows old, new and reason | `checklists.test.ts` |
| 10 | 200-line checklist on a mid-range Android | Not measured on a device: the phone table is a virtualised `FlatList` with search and a "not done" filter. Check on a real device before release (011) | — |

Also covered: reject → the reporter re-checks the line (`recheck`), and closure stays blocked until then; a live-event round 2 gets its
own four steps and reservation without moving the status back; GPS is optional (web sends it if allowed).

## Checks

- Shared 60/60, web integration and contract 244/244, mobile 26/26, Playwright e2e 11/11.
- Typecheck and lint clean (exit code 0).

## Decisions made during implementation

- **When approved damage moves stock**: approving a damage report moves it to Damaged at once, into the line's receipt bin or the
  item's usual bin in its home warehouse. Research R1 moved site-reported damage only when it physically came back; this keeps the
  ledger simple and lets reconciliation close.
- **Photo stamp**: `expo-image-manipulator` cannot draw text, so the stamp (IST time and event number) travels as metadata with each
  queued photo and is shown beside it. The photo itself is compressed to ≤ 1600 px on the device.
- **Phone list**: React Native's built-in `FlatList` instead of `@shopify/flash-list`, to avoid a new native dependency before 011.
- **GPS on phones**: `expo-location` is not added yet, so phones submit without coordinates; refusing GPS never blocks a step (spec edge case).
- **Damage photo deletion**: `delete_after` is set to the decision time + 6 months; the deletion job arrives with retention in 010.
