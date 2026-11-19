# API Contract — 011-mobile-release

Extends [001 api-v1](../../001-overview/contracts/api-v1.md).

| Method & path | Who | Notes |
| --- | --- | --- |
| GET/POST `/api/v1/admin/releases`, PATCH `/…/{id}` | Super Admin | store status, notes |
| PUT `/api/v1/admin/releases/{id}/checks` | Super Admin | `{ checks: [{ key, passed, device }] }` |
| PUT `/api/v1/admin/mobile-versions/{platform}` (001) | Super Admin | now `409 VERSION_NOT_LIVE` if minimum > highest live release |
| POST `/api/v1/me/deletion-request` | signed in | `202`; idempotent |
| GET `/api/v1/admin/deletion-requests`; POST `/…/{id}/complete` | Admin | pseudonymise |
| GET `/privacy` | public | privacy policy page |
