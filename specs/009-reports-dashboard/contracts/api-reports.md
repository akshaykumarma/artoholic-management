# API Contract — 009-reports-dashboard

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). Schemas:
`packages/shared/src/contracts/reports.ts`.

| Method & path | Who | Notes |
| --- | --- | --- |
| GET `/api/v1/reports` | signed in | registry: ids, titles, filters, columns |
| POST `/api/v1/reports/{reportId}/run` | `reports.run` (scoped) | `{ filters, page, pageSize }` → `{ columns, rows, total }` |
| POST `/api/v1/reports/{reportId}/export` | same | → `202 { runId }`; GET `/api/v1/reports/runs/{runId}` → `{ status, fileUrl }` |
| GET/POST `/api/v1/report-schedules`, PATCH/DELETE `/…/{id}` | Admin | recipients: Admin user ids only (`400 RECIPIENT_NOT_ADMIN`) |
| GET `/api/v1/report-schedules/{id}/runs` | Admin | runs with delivery statuses |
| GET `/api/v1/dashboard` | Admin | `{ today: {dispatches, returns}, week: {…}, eventsByStatus, pendingApprovals: {damage, variances, writeOffs, corrections, transferShortfalls}, damageValueMonthPaise, lowStockCount, overbookedCount, nextCounts[] }` |
