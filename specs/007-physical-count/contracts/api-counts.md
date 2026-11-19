# API Contract — 007-physical-count

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). Schemas:
`packages/shared/src/contracts/counts.ts`.

New errors: `ADJUSTMENT_NEGATIVE` (409), `UNCOUNTED_LINES` (400, needs `confirmZero`),
`SESSION_STATE` (409).

| Method & path | Who | Notes |
| --- | --- | --- |
| GET/POST `/api/v1/counts/schedules`, PATCH `/…/{id}` | Admin | pause via `status` |
| POST `/api/v1/counts/sessions` | Admin | ad hoc `{ scope, assignees, blind }` |
| GET `/api/v1/counts/sessions?status=&warehouseId=` | Admin; SM assigned | |
| GET `/api/v1/counts/sessions/{id}/sheet` | assigned SM / Admin | lines in bin order; `recordedQty` omitted when blind and caller is a counter |
| PUT `/api/v1/counts/sessions/{id}/entries` | assigned SM | `{ entries: [{ lineId? , itemId, pieceId?, locationId, countedQty, note?, photoKey? }] }` |
| POST `/api/v1/counts/sessions/{id}/submit` | assigned SM | `{ confirmZero: boolean }` |
| GET `/api/v1/counts/sessions/{id}/review` | Admin | variances in qty and ₹, sorted by ₹ impact |
| POST `/api/v1/counts/lines/{lineId}/approve` \| `/reject` | Admin | `{ reason }` |
