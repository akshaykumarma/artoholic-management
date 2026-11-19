# Implementation Plan: Reports & Admin Dashboard

**Branch**: `009-reports-dashboard` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-reports-dashboard/spec.md`

## Summary

A report registry (R1–R10), each defined once as a typed query + column spec, rendered as paged
JSON for screens and streamed to `.xlsx`; Admin-only schedules (daily/weekly/monthly, IST)
executed by pg-boss and delivered through 008 as WhatsApp documents and email attachments with
logged retries; role-scoped on-demand runs; an Admin dashboard of live counts. Decisions:
[research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001

**Primary Dependencies**: `exceljs` streaming writer; pg-boss cron; 008 channels;
`expo-sharing` + `expo-file-system` (mobile share)

**Storage**: PostgreSQL — `report_schedules`, `report_schedule_recipients`, `report_runs`;
bucket `reports` (files kept 90 days; delivery records permanent via 008 log)

**Testing**: Vitest — each report's figures against seeded ledger fixtures (SC-002), scoping,
Excel cell types and formats, month-end scheduling, retry; contract tests; Playwright schedule
setup

**Performance Goals**: First page ≤ 5 s and Excel ≤ 30 s for 5,000 rows; scheduled delivery
≤ 15 min after time for 99% (SC-001); dashboard ≤ 3 s on 4G

**Constraints**: Recipients Admins only (Q13); exports follow 001 display conventions with
numeric cells

**Scale/Scope**: 10 reports; ≈ 20 schedules

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Fixture-based expected outputs per report before queries are written. | Pass |
| II. Ledger | Reports read ledger/balances only; never write stock. | Pass |
| III. One API contract | `/api/v1/reports/*` shared schemas incl. column metadata. | Pass |
| IV. Field-first mobile | Reports viewable and shareable on phone. | Pass |
| V. Security & audit | Scope filters enforced in SQL by role; schedule changes audited; files via signed URLs. | Pass |
| VI. Simplicity | Registry of plain SQL queries; no BI engine. | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/009-reports-dashboard/ (plan, research, data-model, quickstart, contracts/api-reports.md)

packages/shared/src/reports/registry.ts       # ids, titles, filters, columns (types, formats)
packages/shared/src/contracts/reports.ts
apps/web/server/reports/{queries/R1…R10.ts,run.ts,xlsx.ts,scope.ts}
apps/web/server/jobs/reports/                 # schedule runner, delivery
apps/web/server/dashboard/
apps/web/app/api/v1/{reports,dashboard}/… · app/(shell)/reports/… · (shell)/page.tsx (dashboard)
apps/mobile/app/(shell)/reports/…
```

## Complexity Tracking

No violations.
