# Quickstart & Validation: 001-overview

Proves the shell works end to end. Endpoint shapes: [contracts/api-v1.md](contracts/api-v1.md).
Reference values: [contracts/display-conventions.md](contracts/display-conventions.md).

## Prerequisites

- Node.js 20 LTS or newer, npm 10, Docker with Compose
- For mobile: Expo Go or a development build on an Android phone / iPhone, or an emulator

## Setup

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
docker compose up -d db minio
```

```bash
npm run db:migrate
```

```bash
SUPER_ADMIN_USERNAME=owner SUPER_ADMIN_PASSWORD='choose-a-strong-one' SUPER_ADMIN_NAME='Owner' npm run seed:super-admin
```

```bash
npm run dev:web
```

```bash
npm run dev:mobile
```

## Automated checks (all must pass)

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run test:e2e
```

`npm test` runs shared-package unit tests (every row of the display-conventions table),
API contract tests against a real database, and mobile screen tests (`jest-expo`).

## Manual validation scenarios

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Open http://localhost:3000, sign in as `owner` | Home shows name, "Super Admin", menu: Home, Platform status | US1-1, SC-001 |
| 2 | Sign in on Android and iOS | Same menu minus web-only entries | US1-2 |
| 3 | Sign out, open `/admin/status` | Sent to sign-in; after sign-in returned to `/admin/status` | US1-5 |
| 4 | Wrong password 5 times | 5th and later: "try again at HH:mm IST" lock message; same generic message before | US1-6, FR-006 |
| 5 | Open the reference sample screen (Home → "Display conventions" link, Super Admin only) on all three apps | Every value equals the table in display-conventions.md | US2, SC-002 |
| 6 | Change device time zone to UTC−8 and reopen | Times unchanged (IST) | FR-010 |
| 7 | Leave web idle 60 min (or set `WEB_IDLE_MINUTES=1` in dev), then click | Sign-in, then back to the same page | FR-005a |
| 8 | Set Android minimum version above the installed one in Platform status | Next launch or foreground: blocking "Update required" with store button | US3-1, SC-005 |
| 9 | Set only recommended version above installed | Dismissible prompt, not shown again the same day | US3-2 |
| 10 | Stop MinIO (`docker compose stop minio`) and refresh Platform status | File storage "Down", overall "Degraded" within 1 min; `GET /api/health` still `up` | US4-2, SC-006 |
| 11 | `curl -s localhost:3000/api/health` | `{"status":"up"}` and nothing else | US4-3 |
