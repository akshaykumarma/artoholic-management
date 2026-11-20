---
description: "Task list for 010-admin-console"
---

# Tasks: Super Admin Console, Audit Log & Operations

**Input**: `specs/010-admin-console/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–009 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Backup runner image with PostgreSQL 15 client and rclone `deploy/backup/Dockerfile`; backup bucket env keys in `.env.example`

## Phase 2: Foundational

- [X] T002 Migration: `company_profile`, `master_list_values` (migrate event types and reasons), `backup_records`, `restore_tests`, `retention_runs`, archive tables, maintenance DB role in `apps/web/db/schema.ts` and `apps/web/db/migrations/`
- [X] T003 [P] Console layout (web-only, phone notice) `apps/web/app/(shell)/admin/layout.tsx`; mark console module shipped

## Phase 3: US1 — Search the audit log (P1) 🎯 MVP

- [X] T004 [P] [US1] Tests: filters, keyset paging, ≤ 3 s at 500k seeded rows, Admin read-only, no edit path in `apps/web/tests/integration/audit-search.test.ts`
- [X] T005 [US1] Audit search + export (inline ≤ 100k else background + emailed link) `apps/web/server/admin/audit-search.ts`; routes `apps/web/app/api/v1/admin/audit/{route,export/route}.ts`
- [X] T006 [P] [US1] Audit screen `apps/web/app/(shell)/admin/audit/page.tsx`

## Phase 4: US2 — Login & activity with the message log (P1)

- [X] T007 [P] [US2] Tests: end one session only; codes redacted in log view in `apps/web/tests/integration/activity.test.ts`
- [X] T008 [US2] Routes `apps/web/app/api/v1/admin/activity/{sign-ins,sessions,sessions/[id]/end}/route.ts`; page `apps/web/app/(shell)/admin/activity/page.tsx` (sign-ins, sessions, 008 message log)

## Phase 5: US3 — Company profile and master lists (P2)

- [X] T009 [P] [US3] Tests: archive-only when in use; GSTIN format in `apps/web/tests/integration/master-lists.test.ts`
- [X] T010 [US3] Services and routes `apps/web/app/api/v1/admin/{company-profile,lists/[list]}/route.ts`; screens `apps/web/app/(shell)/admin/{profile,lists}/…`; use logo in emails/xlsx

## Phase 6: US4 — Bulk import centre (P2)

- [X] T011 [P] [US4] Tests: users/locations templates added; nothing saved with errors; audit per created record in `apps/web/tests/integration/import-centre.test.ts`
- [X] T012 [US4] Extend `apps/web/server/imports/` with `users` and `locations` kinds; screen `apps/web/app/(shell)/admin/imports/page.tsx`

## Phase 7: US5 — Backups and restore (P2)

- [X] T013 [P] [US5] Tests: failure alert ≤ 15 min; restore-test reminder after 100 days in `apps/web/tests/integration/backups.test.ts`
- [X] T014 [US5] Backup job `apps/web/server/jobs/backup.ts` (02:00 IST, pg_dump + rclone, 30-day lifecycle); routes `apps/web/app/api/v1/admin/{backups,restore-tests}/route.ts`; screen `apps/web/app/(shell)/admin/backups/page.tsx`
- [X] T015 [US5] Restore runbook `docs/runbooks/restore.md`

## Phase 8: US6 — Data retention (P2)

- [X] T016 [P] [US6] Tests: damage photos removed only for decided reports on closed events after 6 months; roll-up keeps balances identical; audit archive; nothing touched on open events in `apps/web/tests/integration/retention.test.ts`
- [X] T017 [US6] Jobs `apps/web/server/jobs/{retention,ledger-rollup}.ts` (03:00 IST, maintenance role); route `apps/web/app/api/v1/admin/retention/route.ts`; screen `apps/web/app/(shell)/admin/retention/page.tsx`

## Phase 9: US7 — System health extras (P3)

- [X] T018 [P] [US7] Contract test for extended `/api/v1/admin/status` in `apps/web/tests/contract/status-extended.test.ts`
- [X] T019 [US7] Extend `apps/web/server/health/checks.ts` and status page with queue length, failed messages 24 h, storage, last backup, app versions

## Phase 10: Polish

- [X] T020 Perform the first restore test per runbook and record it; run quickstart 1–7; record in `specs/010-admin-console/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 → US2 = MVP; US5 and US6 before go-live; US3, US4, US7 any order.
