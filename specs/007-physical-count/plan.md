# Implementation Plan: Physical Counts & Stock Adjustments

**Branch**: `007-physical-count` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-physical-count/spec.md`

## Summary

Count schedules with frequency, scope and assignees; sessions created at 07:00 IST on due dates
(and ad hoc) with a snapshot of in-bin stock; blind count sheets in bin order on phones with
drafts; variance per line in quantity and ₹; Admin approve/reject per line, approvals posting
`adjustment` movements that account for movements since the snapshot; daily escalation of
overdue sessions. Decisions: [research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001

**Primary Dependencies**: 001–006 stack; pg-boss cron for due dates and escalation

**Storage**: PostgreSQL — `count_schedules`, `count_schedule_scope`, `count_sessions`,
`count_lines`

**Testing**: Vitest — next-due-date rules (month-end, pause/resume), snapshot contents, blind
hiding at the API layer, adjustment math with post-snapshot movements, negative-result refusal;
contract tests; jest-expo count sheet with drafts

**Performance Goals**: Session creation for 10,000 lines ≤ 30 s; 100 lines counted ≤ 30 min
(SC-001); decision → movement ≤ 5 s (SC-003)

**Constraints**: Blind counts never expose recorded quantities to counters (API omits them);
no stock freeze

**Scale/Scope**: ≤ 10,000 lines per session; monthly cadence typical

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Schedule maths, blind omission, adjustment formula and refusal tested first. | Pass |
| II. Ledger | Approved variances post `adjustment` movements referencing the session; nothing else changes stock. | Pass |
| III. One API contract | `/api/v1/counts/*` shared schemas; contract tests assert blind responses omit fields. | Pass |
| IV. Field-first mobile | Sheet in walking (bin code) order, drafts, numeric entry, flags for live event movement. | Pass |
| V. Security & audit | Store Manager scope; decisions audited. | Pass |
| VI. Simplicity | Snapshot stored per line (no separate snapshot tables). | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/007-physical-count/ (plan, research, data-model, quickstart, contracts/api-counts.md)

packages/shared/src/contracts/counts.ts
packages/shared/src/counts/schedule.ts      # next-due-date computation
apps/web/server/counts/                     # schedules, session creation, submission, decisions
apps/web/server/jobs/counts/                # due-date creation 07:00 IST, overdue escalation
apps/web/app/api/v1/counts/… · app/(shell)/counts/…
apps/mobile/app/(shell)/counts/[sessionId].tsx
```

## Complexity Tracking

No violations.
