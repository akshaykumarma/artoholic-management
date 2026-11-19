# Validation record: 007 Physical Count

**Date**: 2026-11-19 · **Branch**: `007-implementation`

## Quickstart scenarios

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Monthly schedule from 31-01-2027 | Pass: due 31-01, 28-02, 31-03, 30-04; weekly, quarterly, half-yearly and yearly clamp correctly | `packages/shared/tests/count-schedule.test.ts` |
| 2 | Run the 07:00 IST job twice on a due date | Pass: nothing before 07:00 IST; one `CNT-YYYY-0001`; next due moves to 28-02; assignees told (`count.due`) | `tests/integration/counts.test.ts` |
| 3 | Open a blind sheet as a counter; inspect the API response | Pass: no `recordedQty` anywhere for the counter; Admins see it | `counts.test.ts`; mobile `count-sheet.test.tsx` |
| 4 | Variances −3 and +2; approve −3, reject +2 | Pass: −3 adjustment movement referencing the line; +2 back to recount, counter told; after the recount the session completes | `counts.test.ts`; e2e `stock-stocktake.spec.ts` |
| 5 | 5 chairs arrive after the snapshot, then approve that line | Pass: adjustment = counted − recorded at the snapshot, applied to today's balance (45 − 5 = 40, not 35); an adjustment that would go below zero → `ADJUSTMENT_NEGATIVE` and the line is sent back for recount | `counts.test.ts` |
| 6 | Session open 3 days past due | Pass: Admins told at 07:00 IST on day 3, once a day | `counts.test.ts` |

Also covered:
- Pausing stops sessions; resuming skips the missed periods.
- Only Store Managers can be assignees, and only Admins manage schedules.
- Ad-hoc counts by category; deactivated warehouses are skipped with a note.
- An item found where the record has none is added as a new line.
- Uncounted lines need "none found" confirmed (`UNCOUNTED_LINES`).
- Lines for items in an event movement are flagged.
- Variance is shown in ₹ at replacement value, biggest first.
- Counts are kept on the device across restarts.

## Checks

- Shared 63/63, web integration and contract 250/250, mobile 28/28, Playwright e2e 12/12.
- Typecheck and lint clean (exit code 0).

## Notes

- Per-piece lengths for cut products are counted per piece line (one line per piece and bin). A piece that isn't found is counted as zero.
- Count photos are accepted (`photoKey`) but not yet captured on the phone screen. Damage photos (006) cover the photo pipeline.
