---
description: "Task list for 001-overview"
---

# Tasks: Platform Overview, Conventions & App Shell

**Input**: `specs/001-overview/` — plan.md, spec.md, research.md, data-model.md,
contracts/api-v1.md, contracts/display-conventions.md, quickstart.md

**Tests**: REQUIRED — constitution principle I (test-first). Every test task is written and seen
failing before its implementation task.

**Paths**: monorepo per plan — `apps/web`, `apps/mobile`, `packages/shared`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create root `package.json` with npm workspaces `apps/*`, `packages/*` and scripts `dev:web`, `dev:mobile`, `typecheck`, `lint`, `test`, `test:e2e`, `db:migrate`, `seed:super-admin`; add `tsconfig.base.json` (strict, ES2022, path aliases `@shared/*`)
- [X] T002 [P] Scaffold `packages/shared` (TypeScript library, `src/index.ts`, Vitest config `packages/shared/vitest.config.ts`)
- [X] T003 [P] Scaffold `apps/web` with Next.js 14 App Router, TypeScript, `apps/web/next.config.mjs` transpiling `@artoholic/shared`
- [X] T004 [P] Scaffold `apps/mobile` with Expo (Expo Router, TypeScript), `apps/mobile/app.config.ts` (name "Artoholic", scheme `artoholic`), `apps/mobile/metro.config.js` for the monorepo, `jest-expo` preset in `apps/mobile/jest.config.js`
- [X] T005 [P] Configure ESLint + Prettier at root `.eslintrc.cjs` incl. `react/jsx-no-literals` for `apps/web/app/**` and `apps/mobile/app/**` (research R11)
- [X] T006 [P] Create `docker-compose.yml` with `db` (postgres:15-alpine, healthcheck), `minio` (healthcheck, bucket bootstrap), `web` (Dockerfile at `apps/web/Dockerfile`)
- [X] T007 [P] Create `.env.example` (DATABASE_URL, S3_ENDPOINT/KEY/SECRET/BUCKET, APP_BASE_URL, WEB_IDLE_MINUTES=60, MOBILE_SESSION_DAYS=30) and add `.env` to `.gitignore` check
- [X] T008 [P] Create CI workflow `.github/workflows/ci.yml`: install, typecheck, lint, unit+contract tests with a postgres service, Playwright e2e

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T009 Configure Drizzle in `apps/web/drizzle.config.ts` and DB client `apps/web/db/client.ts`; migration runner `apps/web/db/migrate.ts`
- [X] T010 Define tables from data-model.md in `apps/web/db/schema.ts`: users, user_roles (partial unique for super_admin), sessions, sign_in_attempts, audit_entries, number_sequences, mobile_version_settings, system_heartbeats; generate first migration in `apps/web/db/migrations/`
- [X] T011 Make `audit_entries` append-only (implemented as a BEFORE UPDATE OR DELETE trigger in `apps/web/db/migrations/0000_init.sql`, which holds for every role including the owner)
- [X] T012 [P] Shared error contract (codes from contracts/api-v1.md) in `packages/shared/src/contracts/errors.ts`
- [X] T013 [P] HTTP helpers (error responses, request context with client platform/version/IP) in `apps/web/server/http/`
- [X] T014 [P] Integration test harness: fresh schema per test file, factories, in `apps/web/tests/setup.ts` and `apps/web/vitest.config.ts`
- [X] T015 [P] String catalogue + `t()` in `packages/shared/src/i18n/en.ts` and `packages/shared/src/i18n/index.ts`
- [X] T016 Audit writer `writeAudit(tx, entry)` in `apps/web/server/audit/write.ts` (never stores passwords/tokens)
- [X] T017 [P] Structured JSON logger in `apps/web/server/http/logger.ts`

**Checkpoint**: schema migrates; harness runs an empty test.

---

## Phase 3: User Story 1 — Sign in and land on a role-aware home screen (P1) 🎯 MVP

**Goal**: Super Admin signs in on web, Android and iOS and sees the role menu; access control enforced.
**Independent test**: quickstart scenarios 1–4.

### Tests (write first, must fail)

- [X] T018 [P] [US1] Unit tests for menu builder (union, de-dup, shipped only, per-app filter) in `packages/shared/tests/menu.test.ts`
- [X] T019 [P] [US1] Integration tests for lockout (5 fails/15 min, unknown-user by IP, generic message) in `apps/web/tests/integration/lockout.test.ts`
- [X] T020 [P] [US1] Integration tests for sessions: web sliding 60-min idle, mobile fixed 30-day, revoked/deactivated refused, roles re-read per request in `apps/web/tests/integration/sessions.test.ts`
- [X] T021 [P] [US1] Integration test: `requirePermission` refuses outside roles regardless of menu in `apps/web/tests/integration/permissions.test.ts`
- [X] T022 [P] [US1] Contract tests for `POST /api/v1/auth/sign-in`, `POST /api/v1/auth/sign-out`, `GET /api/v1/me` in `apps/web/tests/contract/auth.test.ts`
- [X] T023 [P] [US1] Integration test: CSRF required on web state-changing requests in `apps/web/tests/integration/csrf.test.ts`
- [X] T024 [P] [US1] Playwright: sign-in, menu, return-to after sign-in, access-denied, sign-out in `apps/web/tests/e2e/shell.spec.ts`
- [X] T025 [P] [US1] jest-expo tests: sign-in screen, menu rendering, session-expired redirect with draft restore in `apps/mobile/tests/shell.test.tsx`

### Implementation

- [X] T026 [P] [US1] Roles, permissions (`admin.status.view`, `admin.mobile_versions.edit`) and `ROLE_PERMISSIONS` in `packages/shared/src/auth/permissions.ts`
- [X] T027 [P] [US1] Module map (all modules per spec, `shipped` only for home and admin-status) and `buildMenu()` in `packages/shared/src/modules/index.ts`
- [X] T028 [P] [US1] zod schemas for sign-in, me in `packages/shared/src/contracts/auth.ts`
- [X] T029 [US1] Password hashing (bcrypt 12, dummy-hash comparison) in `apps/web/server/auth/password.ts`
- [X] T030 [US1] Lockout service in `apps/web/server/auth/lockout.ts`
- [X] T031 [US1] Session service (create, validate, slide, revoke; token SHA-256) in `apps/web/server/auth/sessions.ts`
- [X] T032 [US1] `requireSession` and `requirePermission` guards in `apps/web/server/auth/guards.ts`
- [X] T033 [US1] CSRF double-submit helper in `apps/web/server/auth/csrf.ts`, enforced in the API wrapper `apps/web/server/http/handler.ts`; `apps/web/middleware.ts` passes the requested path to pages
- [X] T034 [US1] Route handlers `apps/web/app/api/v1/auth/sign-in/route.ts`, `apps/web/app/api/v1/auth/sign-out/route.ts`, `apps/web/app/api/v1/me/route.ts` (audit sign-in/failed/sign-out)
- [X] T035 [US1] Super Admin seed script `apps/web/scripts/seed-super-admin.ts` (refuses if one exists)
- [X] T036 [P] [US1] Typed API client (headers, CSRF, bearer, 401→SESSION_EXPIRED, 426 handling hook) in `packages/shared/src/api-client/index.ts`
- [X] T037 [P] [US1] `DraftStore` interface in `packages/shared/src/drafts/index.ts`; web implementation `apps/web/lib/drafts.ts`; mobile implementation `apps/mobile/src/drafts.ts`
- [X] T038 [US1] Web sign-in page `apps/web/app/(auth)/sign-in/page.tsx` with return-to
- [X] T039 [US1] Web shell layout + role menu + home `apps/web/app/(shell)/layout.tsx`, `apps/web/app/(shell)/page.tsx`, access-denied `apps/web/app/(shell)/forbidden/page.tsx`
- [X] T040 [US1] Mobile secure token store `apps/mobile/src/auth/token.ts` (expo-secure-store) and session bootstrap in `apps/mobile/src/auth/AuthContext.tsx`, mounted from `apps/mobile/app/_layout.tsx`
- [X] T041 [US1] Mobile sign-in `apps/mobile/app/sign-in.tsx`, shell stack with session redirect `apps/mobile/app/(shell)/_layout.tsx`, home with the role menu `apps/mobile/app/(shell)/index.tsx` (a stack plus home menu instead of a drawer: no extra gesture/animation libraries until a feature needs them)

**Checkpoint**: US1 tests green; quickstart 1–4 pass.

---

## Phase 4: User Story 2 — Consistent dates, money, times and identifiers (P1)

**Goal**: one formatting library used everywhere; record-number sequences.
**Independent test**: every row of contracts/display-conventions.md; quickstart 5–6; SC-007.

### Tests (write first)

- [X] T042 [P] [US2] Table-driven tests for every display-conventions row in `packages/shared/tests/format.test.ts`
- [X] T043 [P] [US2] Integration test: 1,000 concurrent `issueRecordNumber` calls → 1,000 distinct consecutive numbers; rollback releases; IST year boundary in `apps/web/tests/integration/sequences.test.ts`
- [X] T044 [P] [US2] jest-expo snapshot of reference sample screen with device TZ forced to UTC−8 in `apps/mobile/tests/conventions.test.tsx`

### Implementation

- [X] T045 [P] [US2] IST date/time formatters (fixed +05:30, manual digits) in `packages/shared/src/format/datetime.ts`
- [X] T046 [P] [US2] Money (paise, Indian grouping, U+2212 minus) in `packages/shared/src/format/money.ts`
- [X] T047 [P] [US2] Quantity (decimal strings, ≤3 dp, unit suffix) in `packages/shared/src/format/quantity.ts`
- [X] T048 [P] [US2] Phone display in `packages/shared/src/format/phone.ts`
- [X] T049 [P] [US2] `formatRecordNumber(kind, year, n)` in `packages/shared/src/format/record-number.ts`
- [X] T050 [US2] `issueRecordNumber(tx, kind)` using `INSERT … ON CONFLICT … RETURNING` in `apps/web/server/sequences/issue.ts`
- [X] T051 [US2] Reference sample screens (Super Admin) `apps/web/app/(shell)/reference/conventions/page.tsx` and `apps/mobile/app/(shell)/reference/conventions.tsx`

**Checkpoint**: format and sequence tests green.

---

## Phase 5: User Story 3 — Out-of-date mobile apps are told to update (P2)

**Goal**: version gate with blocking screen and recommended prompt.
**Independent test**: quickstart 8–9; SC-005.

### Tests (write first)

- [X] T052 [P] [US3] Contract tests `GET /api/v1/app-version` and `PUT /api/v1/admin/mobile-versions/{platform}` (validation recommended ≥ minimum, audit) in `apps/web/tests/contract/app-version.test.ts`
- [X] T053 [P] [US3] Integration test: middleware returns 426 `APP_UPDATE_REQUIRED` below minimum; settings cache ≤ 30 s in `apps/web/tests/integration/version-gate.test.ts`
- [X] T054 [P] [US3] jest-expo tests: blocking screen on launch/foreground, once-a-day prompt, offline check does not block in `apps/mobile/tests/update.test.tsx`

### Implementation

- [X] T055 [P] [US3] Semver compare + schemas in `packages/shared/src/contracts/app-version.ts`
- [X] T056 [US3] Version settings service (cached read, audited write) in `apps/web/server/versions/settings.ts`; seed `0.0.0` rows in migration
- [X] T057 [US3] Routes `apps/web/app/api/v1/app-version/route.ts` and `apps/web/app/api/v1/admin/mobile-versions/[platform]/route.ts`; gate in the API wrapper `apps/web/server/http/handler.ts` (Next middleware runs on the edge runtime and cannot read the database)
- [X] T058 [US3] Mobile version check hook `apps/mobile/src/version/useVersionCheck.ts`; blocking screen and recommended prompt in `apps/mobile/src/version/UpdateRequired.tsx`, applied by the version gate in `apps/mobile/app/_layout.tsx` (so no other screen is reachable while blocked)
- [X] T059 [US3] Web settings form for mobile versions in `apps/web/app/(shell)/admin/status/MobileVersionsForm.tsx`

**Checkpoint**: quickstart 8–9 pass.

---

## Phase 6: User Story 4 — Super Admin can see the platform is healthy (P3)

**Goal**: status page and public health check.
**Independent test**: quickstart 10–11; SC-006.

### Tests (write first)

- [X] T060 [P] [US4] Contract tests `GET /api/health` (only `status`) and `GET /api/v1/admin/status` (Super Admin only) in `apps/web/tests/contract/health.test.ts`
- [X] T061 [P] [US4] Integration test: storage down → part `down`, overall `degraded`; DB down → public `down`; stale heartbeat → backgroundWork `down` in `apps/web/tests/integration/health.test.ts`

### Implementation

- [X] T062 [P] [US4] Health checks (db, S3 HeadBucket, heartbeat) with 2 s timeouts and 10 s memo in `apps/web/server/health/checks.ts`
- [X] T063 [P] [US4] pg-boss boot and 30 s heartbeat job in `apps/web/server/jobs/boss.ts` and `apps/web/server/jobs/heartbeat.ts` (started from `apps/web/instrumentation.ts`)
- [X] T064 [US4] Routes `apps/web/app/api/health/route.ts` and `apps/web/app/api/v1/admin/status/route.ts`
- [X] T065 [US4] Status page `apps/web/app/(shell)/admin/status/page.tsx` (parts, overall, version, mobile versions form from T059)

---

## Phase 7: Polish & Cross-Cutting

- [X] T066 [P] Accessibility pass (labels, focus, contrast WCAG 2.1 AA) on web shell pages; RN `accessibilityLabel`s on mobile shell
- [X] T067 [P] EAS config `apps/mobile/eas.json` with `development` and `preview` (internal distribution) profiles
- [X] T068 [P] Root `README.md` update: setup and scripts per quickstart
- [ ] T069 Run every quickstart scenario on web, an Android device and an iPhone; record results in `specs/001-overview/checklists/validation.md`
- [X] T070 Performance check: API p95 under 50 concurrent users (results and the 50-simultaneous sign-in limit in `specs/001-overview/checklists/validation.md`); home ≤ 3 s on 4G mid-range Android (SC-008) is checked with T069 on a device

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories. US1 first (shell, auth, client). US2 depends only on Phase 2
  (can run in parallel with US1). US3 depends on US1 (middleware, client). US4 depends on
  Phase 2 and the status page shell from US1.
- Within a story: tests → shared schemas/helpers → server services → routes → UI.

### Parallel examples

- US1: T018–T025 together; then T026, T027, T028, T036, T037 together.
- US2: T045–T049 together after T042.
- US3/US4 tests (T052–T054, T060–T061) can be written while US1 implementation proceeds.

## Implementation Strategy

1. MVP = Phases 1–3 (sign-in + menu on three apps) → demo to owner.
2. Add US2 (conventions) — required before 002 starts showing data.
3. Add US3 and US4; polish; validate quickstart; PR and merge per CLAUDE.md.
