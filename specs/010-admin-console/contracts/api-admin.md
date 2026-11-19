# API Contract — 010-admin-console

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). All endpoints Super Admin unless
noted.

| Method & path | Notes |
| --- | --- |
| GET/PUT `/api/v1/admin/company-profile` | logo via upload-url |
| GET/POST/PATCH `/api/v1/admin/lists/{list}` | archive via status |
| GET `/api/v1/admin/audit?from=&to=&actorId=&action=&entityType=&entityId=&cursor=` | Super Admin and Admin (read) |
| POST `/api/v1/admin/audit/export` | Super Admin and Admin; ≤ 100k rows inline xlsx, else `202` + emailed link |
| GET `/api/v1/admin/activity/sign-ins?userId=&from=&to=` | |
| GET `/api/v1/admin/activity/sessions?userId=`; POST `/…/sessions/{id}/end` | |
| GET `/api/v1/admin/messages` | from 008 |
| GET `/api/v1/imports/templates/{kind}`, POST `/api/v1/imports`, POST `/api/v1/imports/{id}/commit` | from 003; kinds `users`, `categories`, `items`, `opening_stock`, `locations`; Admins allowed |
| GET `/api/v1/admin/backups`; POST `/api/v1/admin/restore-tests` | |
| GET `/api/v1/admin/retention` | rules, last runs |
| GET `/api/v1/admin/status` | 001 status + `jobQueue`, `failedMessages24h`, `storage`, `lastBackup`, `appVersions[]` |
