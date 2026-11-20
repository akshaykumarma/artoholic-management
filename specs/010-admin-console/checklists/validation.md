# Validation record: 010 Admin Console

**Date**: 2026-11-20 · **Branch**: `010-implementation`

## Scenarios

| Story | Scenario | Result | Evidence |
|-------|----------|--------|----------|
| US1 | Edit an item's replacement value; one audit entry with old/new, who, when; export | Pass | `tests/integration/admin-console.test.ts`; e2e `admin-console.spec.ts` |
| US1-1 | 500,000 entries searched by user and date | Pass: well under 3 s (index on actor + time; keyset paging) | `admin-console.test.ts` |
| US1-2/3 | No edit path (database refuses updates); Admins view and export, Store Managers can't | Pass | `admin-console.test.ts` |
| US2-1 | End one of two phone sessions | Pass: that phone gets 401, the other stays signed in; its push registration is removed | `admin-console.test.ts` |
| US2-2 | Reset codes redacted in the message log | Pass (from 008) | `notifications.test.ts` |
| US3 | GSTIN format check; Super Admin only; values in use can only be archived | Pass | `admin-console.test.ts`; e2e |
| US4 | Users, categories and locations imports; nothing saved while rows have errors unless they are excluded explicitly; one audit entry per created record naming the import | Pass | `admin-console.test.ts` |
| US5-1 | Failed backup → Super Admin told (in-app and email) | Pass | `admin-console.test.ts` |
| US5-2 | No restore test for 100 days → reminder, once a day; recording a test stops it | Pass | `admin-console.test.ts` |
| US6-1 | Damage photos removed 6 months after the decision only on Closed events; the report stays | Pass | `admin-console.test.ts` |
| US6-2 | Ledger roll-up keeps every balance identical; blocked while any old movement belongs to an open event | Pass | `admin-console.test.ts` |
| US6-3 | Retention page shows each rule, last run and counts | Pass | `admin-console.test.ts` |
| US7 | Status page: queue length, failed messages (24 h, linked to the filtered log), storage, last backup, app versions | Pass | `admin-console.test.ts` |

## First restore test (T020)

Performed 2026-11-20 in the development environment, following `docs/runbooks/restore.md`:
- `pg_dump -Fc` of the e2e database (319 KB), restored into a scratch database with `pg_restore`.
- The stock check gave **0 mismatches**, and row counts matched the source (6 movements, 2 events, 4 messages).
- Restore took 2 s.

**Result: passed.** Repeat this on production backups once the backup bucket is set up, and record it in Admin console → Backups.

## Checks

- Shared 67/67, web integration and contract 277/277, mobile 32/32, Playwright e2e 15/15.
- Typecheck and lint clean (exit code 0).

## Before going live (owner actions)

- Build `deploy/backup` and set `BACKUP_COMMAND`, `BACKUP_BUCKET` and the rclone remotes. Put a 30-day lifecycle rule on the
  backup bucket. Until then the nightly backup records a failure in production and alerts the Super Admin.
- Upload the company logo and enter the GSTIN in Admin console → Company profile.

## Notes

- References from damage reports, counts, corrections and requests to stock movements are now soft (no foreign key), so
  rolled-up movements can move to `stock_movements_archive`. Ids stay unique across both tables.
- Event types and units keep their own tables; the master-lists page manages them alongside damage and short-dispatch reasons.
