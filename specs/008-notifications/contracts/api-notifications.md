# API Contract — 008-notifications

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). Schemas:
`packages/shared/src/contracts/notifications.ts`.

| Method & path | Who | Notes |
| --- | --- | --- |
| GET `/api/v1/notifications?cursor=&unread=` | signed in | newest first, 90 days |
| GET `/api/v1/notifications/unread-count` | signed in | polled every 30 s and on push |
| POST `/api/v1/notifications/{id}/read`, POST `/api/v1/notifications/read-all` | signed in | |
| GET/PUT `/api/v1/me/notification-preferences` | signed in | `{ groups: { events: { push, whatsapp, email } … }, quietHours }` |
| POST `/api/v1/me/push-registrations` | mobile | `{ expoToken }` |
| GET `/api/v1/records/{type}/{id}/messages` | as record view | message log for a record (redacted) |
| GET `/api/v1/admin/messages?channel=&status=&from=&to=&q=` | Super Admin | full log |
| GET/PUT `/api/v1/admin/providers/{channel}` | Super Admin | secrets write-only |
| GET/PUT `/api/v1/admin/template-mappings` | Super Admin | |
| POST `/api/v1/admin/providers/{channel}/test` | Super Admin | `{ to }` |
| POST `/api/webhooks/whatsapp` | provider | signature verified; GET for verify token |

Push payload: `{ title, body, data: { path, trigger, recordId } }`.
