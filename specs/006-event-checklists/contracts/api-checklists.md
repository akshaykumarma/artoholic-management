# API Contract — 006-event-checklists

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). Schemas:
`packages/shared/src/contracts/{checklists,damage}.ts`.

New errors: `STEP_ALREADY_SUBMITTED` (409), `STEP_NOT_READY` (409, previous step not
submitted), `PHOTO_REQUIRED` (400, `details.entryIds`), `MISSING_NOT_CONFIRMED` (400),
`ALREADY_DECIDED` (409), `NOT_RECONCILED` (409, `details.lines`, `details.reports`).

| Method & path | Who | Notes |
| --- | --- | --- |
| GET `/api/v1/events/{id}/rounds` | assigned / Admin | rounds, steps, status |
| GET `/api/v1/events/{id}/steps/{stepId}` | step role | table rows (lines sorted by bin), entries, version |
| PUT `/api/v1/events/{id}/steps/{stepId}/progress` | step role | partial entries (in_progress) |
| POST `/api/v1/events/{id}/steps/{stepId}/submit` | step role | `{ version, entries[], transport?, location?, confirmMissing }` |
| POST `/api/v1/events/{id}/rounds` | Admin | `{ lines: [...] }` → new round (EVT-24) |
| POST `/api/v1/photos/upload-url` | signed in | `{ purpose: "damage", contentType }` → `{ url, key }` |
| GET `/api/v1/damage-reports?status=pending&eventId=` | Admin; reporter sees own | |
| GET `/api/v1/damage-reports/{id}` | Admin / reporter | photos (signed URLs) until deleted |
| POST `/api/v1/damage-reports/{id}/approve` \| `/reject` | any Admin | `{ comment }`; reject reopens the entry |
| POST `/api/v1/events/{id}/close` | Admin | gate per FR-008 |
| POST `/api/v1/events/{id}/corrections` | Admin | `{ lineSourceId, field, newValue, reason }` (closed or open events) |
| GET `/api/v1/events/{id}/activity` | assigned / Admin | steps, reports, decisions, corrections, messages (008) |

Step roles: warehouse steps — Store Manager of that warehouse; site and return steps — Event
Manager of the event; Admins can perform any step.
