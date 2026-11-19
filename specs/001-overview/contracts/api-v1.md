# API Contract v1 — 001-overview

Base path `/api/v1` (except `/api/health`). JSON only. Schemas are defined in zod in
`packages/shared/contracts/` and are the single source of truth; this file describes them.

## Common request headers

| Header | Required | Notes |
| --- | --- | --- |
| `X-Client-Platform` | yes | `web` \| `android` \| `ios` |
| `X-Client-Version` | yes | semver of the app build |
| `Authorization: Bearer <token>` | mobile, when signed in | |
| Cookie `session` | web, when signed in | HttpOnly, Secure, SameSite=Lax |
| `X-CSRF-Token` | web, on POST/PUT/PATCH/DELETE | must equal the `csrf` cookie |

## Error format (all endpoints)

```json
{ "error": { "code": "SESSION_EXPIRED", "message": "Your session has ended. Please sign in again.", "details": {} } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | body/query fails schema; `details.fields` maps field → message key |
| 401 | `NOT_SIGNED_IN` | no session |
| 401 | `SESSION_EXPIRED` | session expired or revoked |
| 401 | `INVALID_CREDENTIALS` | wrong username or password (one generic message) |
| 403 | `FORBIDDEN` | signed in but roles do not allow the action |
| 403 | `CSRF_FAILED` | web state-changing request without a valid CSRF token |
| 426 | `APP_UPDATE_REQUIRED` | mobile version below minimum; `details: { storeUrl, minimumVersion }` |
| 429 | `SIGN_IN_LOCKED` | lockout active; `details: { retryAt }` (UTC ISO) |
| 500 | `INTERNAL` | unexpected; no internal detail in `message` |

## Endpoints

### `GET /api/health` — public

`200 { "status": "up" }` or `503 { "status": "down" }`. No other fields. No version headers
required.

### `GET /api/v1/app-version?platform=android|ios` — public

```json
{ "platform": "android", "minimumVersion": "1.0.0", "recommendedVersion": "1.2.0", "storeUrl": "https://play.google.com/store/apps/details?id=…" }
```

The app compares its own version: `< minimum` → blocking screen; `< recommended` → prompt
(at most once per day, stored on the device).

### `POST /api/v1/auth/sign-in` — public

Request `{ "username": string(1..120), "password": string(1..200) }`.

- Web `200`: sets `session` and `csrf` cookies; body `{ "user": Me }`.
- Mobile `200`: body `{ "user": Me, "token": string, "expiresAt": string }`.
- Errors: `400`, `401 INVALID_CREDENTIALS`, `429 SIGN_IN_LOCKED`, `426`.
- Audit: `auth.sign_in` or `auth.sign_in_failed`.

### `POST /api/v1/auth/sign-out` — signed in

`204`. Revokes the session; web clears cookies. Audit: `auth.sign_out`.

### `GET /api/v1/me` — signed in

```json
{
  "id": "uuid",
  "fullName": "Owner",
  "username": "owner@example.com",
  "roles": ["super_admin"],
  "menu": [ { "moduleId": "home", "labelKey": "module.home", "path": "/" },
            { "moduleId": "admin-status", "labelKey": "module.adminStatus", "path": "/admin/status" } ],
  "session": { "expiresAt": "2026-11-19T13:30:00Z", "idleTimeoutMinutes": 60 }
}
```

`idleTimeoutMinutes` is `null` for mobile sessions. `menu` is computed for the requesting
platform (web-only modules omitted on mobile).

### `GET /api/v1/admin/status` — permission `admin.status.view` (Super Admin)

```json
{
  "overall": "ok",
  "platformVersion": "0.1.0",
  "checkedAt": "2026-11-19T12:00:00Z",
  "parts": [
    { "part": "database", "status": "ok", "checkedAt": "…" },
    { "part": "fileStorage", "status": "ok", "checkedAt": "…" },
    { "part": "backgroundWork", "status": "ok", "checkedAt": "…" }
  ],
  "mobileVersions": [ { "platform": "android", "minimumVersion": "…", "recommendedVersion": "…", "storeUrl": "…" },
                      { "platform": "ios", "minimumVersion": "…", "recommendedVersion": "…", "storeUrl": "…" } ]
}
```

`overall`: `ok` | `degraded` | `down`; part `status`: `ok` | `down`.

### `PUT /api/v1/admin/mobile-versions/{platform}` — permission `admin.mobile_versions.edit`

Request `{ "minimumVersion": semver, "recommendedVersion": semver, "storeUrl": https-url }`;
`recommendedVersion ≥ minimumVersion` else `400`. Response `200` with the saved setting.
Audit: `settings.mobile_version_changed` with before/after.

## Contract tests

Each endpoint has a test that (1) calls the handler, (2) parses the body with its zod schema,
(3) asserts status and error `code` for every row of the error table that applies to it.
A breaking change requires `/api/v2` (constitution III).
