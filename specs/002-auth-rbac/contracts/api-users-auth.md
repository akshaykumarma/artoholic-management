# API Contract — 002-auth-rbac

Extends [001 api-v1](../../001-overview/contracts/api-v1.md): same headers, error format, CSRF.
Schemas: `packages/shared/src/contracts/{users,auth}.ts`.

## New error codes

| HTTP | code | When |
| --- | --- | --- |
| 403 | `PASSWORD_CHANGE_REQUIRED` | temporary password not yet changed |
| 409 | `IDENTIFIER_TAKEN` | `details.field`: `phone` \| `email` \| `username` |
| 409 | `LAST_ADMIN` | change would leave no active Admin |
| 409 | `SELF_DEACTIVATION` | user deactivating themselves |
| 403 | `SUPER_ADMIN_ONLY` | non-Super-Admin touching the Admin role or an Admin account |
| 400 | `PASSWORD_POLICY` | `details.rules`: failed rule keys |
| 400 | `RESET_CODE_INVALID` | wrong, expired, used or exhausted code (one code for all) |

## Auth

| Method & path | Auth | Request | Response |
| --- | --- | --- | --- |
| POST `/api/v1/auth/sign-in` | public | `{ identifier, password }` (replaces 001's `username`) | as 001; `user.mustChangePassword` |
| POST `/api/v1/auth/change-password` | signed in | `{ currentPassword, newPassword }` | `204`; revokes other sessions |
| POST `/api/v1/auth/forgot` | public | `{ identifier }` | always `202 { "message": "If an account matches, we've sent a code" }` |
| POST `/api/v1/auth/reset` | public | `{ identifier, code, newPassword }` | `204`; revokes all sessions; `400 RESET_CODE_INVALID` |
| PUT `/api/v1/auth/biometric` | mobile session | `{ enabled: boolean }` | `204` |

## Users (permission `users.manage`; Admin-role changes need `admins.manage`)

| Method & path | Request | Response |
| --- | --- | --- |
| GET `/api/v1/users?q=&role=&status=&warehouseId=&cursor=` | | `{ items: UserSummary[], nextCursor }` |
| POST `/api/v1/users` | `{ fullName, phone, email?, username?, temporaryPassword, roles[], warehouseIds[]? }` | `201 User` |
| GET `/api/v1/users/{id}` | | `User` (roles, active warehouse assignments, status) |
| PATCH `/api/v1/users/{id}` | any of `fullName, phone, email, username, roles, warehouseIds`; `If-Match: <updatedAt>` | `200 User` |
| POST `/api/v1/users/{id}/temporary-password` | `{ temporaryPassword }` | `204`; revokes sessions |
| POST `/api/v1/users/{id}/deactivate` | `{ reason }` | `204` |
| POST `/api/v1/users/{id}/reactivate` | `{ temporaryPassword }` | `204` |

`User`: `{ id, fullName, phone, email|null, username, roles[], warehouseIds[], status,
mustChangePassword, createdAt, updatedAt }` — never a password or hash.

Every mutating endpoint writes an audit entry (`user.created`, `user.updated`,
`user.deactivated`, `user.reactivated`, `user.temp_password_set`, `auth.password_changed`,
`auth.reset_requested`, `auth.reset_completed`).
