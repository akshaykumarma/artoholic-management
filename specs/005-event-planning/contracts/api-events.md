# API Contract — 005-event-planning

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). Schemas:
`packages/shared/src/contracts/events.ts`.

New errors: `EVENT_CHANGED` (409, `details.version`), `EVENT_STATE` (409),
`EVENT_INCOMPLETE` (400, `details.missing[]`), `HANDOVER_NOT_ELIGIBLE` (409).

| Method & path | Permission | Notes |
| --- | --- | --- |
| GET `/api/v1/events?status=&from=&to=&typeId=&managerId=&warehouseId=&overbooked=&cursor=` | `events.view` (scoped) | |
| GET `/api/v1/events/calendar?month=2026-12` | same | compact rows |
| GET `/api/v1/events/today` | same | dispatches and returns due today (IST) |
| POST `/api/v1/events` | `events.manage` | draft or `{ schedule: true }` |
| GET `/api/v1/events/{id}` | scoped | event, assignments, lines with sources, availability, warnings |
| PATCH `/api/v1/events/{id}` | `events.manage`; `If-Match` | full replace of lines allowed before dispatch |
| POST `/api/v1/events/{id}/schedule` | `events.manage` | draft → scheduled |
| POST `/api/v1/events/{id}/cancel` | `events.manage` | `{ reason }` |
| POST `/api/v1/events/{id}/copy` | `events.manage` | → new Draft |
| POST `/api/v1/events/availability` | `events.manage` | `{ window, lines: [{ itemId, qty, sources? }] }` → per line `{ available, shortfall, suggestedWarehouseId, clashingEvents }` |
| GET `/api/v1/events/handover-sources?itemId=&leaveAt=` | `events.manage` | eligible source events with free quantity |
| GET/POST/PATCH `/api/v1/event-types` | read all; write Super Admin | |

Line shape: `{ itemId, plannedQty, unit, sources: [{ type: "warehouse", warehouseId, qty } | { type: "event", eventId, qty }] }`.
