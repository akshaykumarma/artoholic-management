# Implementation Plan: Super Admin Console, Audit Log & Operations

**Branch**: `010-admin-console` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-admin-console/spec.md`

## Summary

A web-only Super Admin console that gathers settings (company profile, master lists,
integrations from 008), the searchable audit log (Admins read-only), Login & activity with
session management and the permanent message log, a unified import centre (templates from
002–004), backups (nightly `pg_dump` + object-storage sync to a separate bucket, 30-day
retention, quarterly restore-test records), nightly retention jobs (damage photos 6 months,
ledger roll-up after 3 years) and an extended status page. Decisions: [research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001 (console is web-only)

**Primary Dependencies**: pg-boss cron; `pg_dump`/`pg_restore` (PostgreSQL 15 client in the
backup container); `rclone` (bucket-to-bucket sync); `exceljs`

**Storage**: PostgreSQL — `company_profile`, `master_list_values`, `backup_records`,
`restore_tests`, `retention_runs`, `ledger_rollups`; separate S3-compatible backup bucket

**Testing**: Vitest — audit search filters and pagination at 500k rows (seeded), retention
selection rules (never touches non-closed events), roll-up preserves balances (SC-004),
backup job success/failure alerting; Playwright console pages

**Performance Goals**: Audit search ≤ 3 s at 500k rows; nightly jobs finish before 05:00 IST

**Constraints**: Audit and message logs never editable; only Super Admin changes settings;
backups off the main server

**Scale/Scope**: 500k audit rows, 500 GB photos over 3 years

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Retention selectors and roll-up equality tested before jobs are written. | Pass |
| II. Ledger | Roll-up inserts an `opening` movement per item/piece/bin/condition then archives older rows to `stock_movements_archive` (cold table) — balances unchanged; DB role still cannot UPDATE/DELETE live ledger rows (purge runs under a separate maintenance role). | Pass |
| III. One API contract | `/api/v1/admin/*` shared schemas. | Pass |
| IV. Field-first mobile | Not applicable (web-only console; phone browser shows notice). | Pass |
| V. Security & audit | Super Admin only for writes; maintenance role isolated; restore actions recorded. | Pass |
| VI. Simplicity | Off-the-shelf `pg_dump` + `rclone`; no backup SaaS. | Pass |
| Service levels | RPO ≤ 24 h, RTO ≤ 4 h, quarterly restore test, retention per NFR-09. | Pass |

**Post-design re-check**: Pass — the roll-up is the one place a maintenance role removes rows,
explicitly allowed by the constitution's retention clause.

## Project Structure

```text
specs/010-admin-console/ (plan, research, data-model, quickstart, contracts/api-admin.md)

apps/web/app/(shell)/admin/{profile,lists,integrations,audit,activity,imports,backups,retention,status}/…
apps/web/server/admin/{profile,lists,audit-search,activity,status}.ts
apps/web/server/jobs/{backup,retention,ledger-rollup}.ts
deploy/backup/Dockerfile            # pg client + rclone, run by the job runner
docs/runbooks/restore.md            # quarterly restore procedure
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Separate DB maintenance role allowed to move old ledger rows | NFR-09 3-year retention with correct balances | Keeping ledger forever contradicts the owner's 3-year decision; deleting without roll-up breaks balances |
