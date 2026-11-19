# Research: 001-overview — Platform Overview, Conventions & App Shell

All Technical Context items were resolvable from the constitution (stack confirmed by the owner,
decision Q10) and the spec's clarifications. Each decision below records what was chosen, why,
and what was rejected.

## R1. Repository layout — one monorepo with npm workspaces

- **Decision**: npm workspaces with three packages:
  - `apps/web` — Next.js 14 (App Router). Serves the web UI **and** the versioned API
    (`/api/v1/*` route handlers) as one deployable, exactly like Service Management.
  - `apps/mobile` — Expo (React Native) app with Expo Router, one codebase for Android and iOS.
  - `packages/shared` — framework-free TypeScript: API contracts (zod schemas + inferred types),
    the API client, display conventions (dates, money, quantities, phone, record numbers), the
    module map, the role → permission table, and the English string catalogue.
- **Rationale**: Constitution III requires one contract for three apps; putting schemas and the
  client in one package used by both apps makes drift a compile error. Keeping the API inside
  the Next.js app reuses the Service Management deployment (one container) and avoids a fourth
  deployable (constitution VI).
- **Alternatives rejected**: separate `api/` service (extra deployable, no current need);
  Turborepo/Nx (build orchestration not needed at this size; npm workspaces suffice); pnpm
  (Expo + Metro work best with npm/yarn hoisting without extra config).

## R2. Sessions for web and mobile — one session table, two transports

- **Decision**: Own session implementation (no Auth.js). A `sessions` table holds an opaque
  random token (stored as SHA-256 hash), user, client type, created/last-seen/expires times.
  - Web: token in an `HttpOnly; Secure; SameSite=Lax` cookie; idle expiry 60 minutes
    (sliding, `last_seen_at` refreshed at most once a minute); CSRF via double-submit token
    (`csrf` cookie + `X-CSRF-Token` header) on every state-changing request.
  - Mobile: same token returned in the sign-in response, stored in `expo-secure-store`
    (Keychain / Keystore), sent as `Authorization: Bearer`; absolute expiry 30 days from sign-in;
    no CSRF needed (no ambient credentials).
  - Every request re-reads the user's status and roles (never cached in the token), so
    deactivation and role changes apply immediately (spec edge cases).
- **Rationale**: Auth.js is cookie-centric; bearer sessions for a native app would need custom
  adapters anyway. One table gives one place to revoke sessions on deactivation (002) and to
  audit. Matches the clarified timeouts.
- **Alternatives rejected**: JWTs (cannot be revoked instantly on deactivation); Auth.js for web
  plus a separate mobile token system (two code paths for the same rule).

## R3. Password hashing and lockout

- **Decision**: `bcrypt` cost 12 (constitution V). Lockout: count failed attempts per account in
  `sign_in_attempts`; 5 failures within 15 minutes → refuse for 15 minutes from the 5th failure.
  Unknown usernames are also recorded and throttled per network address (5 / 15 min) so the
  generic message cannot be used to enumerate accounts. Comparison runs against a dummy hash for
  unknown usernames so timing does not reveal existence.
- **Alternatives rejected**: argon2id (allowed, but bcrypt is already proven in Service
  Management's deployment image).

## R4. Time zone and date formatting without relying on device Intl

- **Decision**: Store `timestamptz` in UTC; plain calendar dates as `date`. Format in
  `packages/shared/format` by adding the fixed IST offset (+05:30; India has no daylight saving)
  and formatting digits by hand — not with `Intl.DateTimeFormat` time zones.
- **Rationale**: Hermes (React Native's engine) has incomplete time-zone support across Android
  versions; manual formatting guarantees identical output on web, Android and iOS (SC-002) and
  ignores the device time zone (FR-010).
- **Alternatives rejected**: `date-fns-tz` / `Intl` (platform-dependent); Luxon (heavy for a
  fixed-offset need).

## R5. Money and quantities

- **Decision**: Money as integer **paise** (`bigint` in PostgreSQL, `number` in TypeScript —
  safe up to ₹90 trillion). Quantities as `numeric(14,3)` transported as decimal **strings** and
  formatted from strings, so no binary floating-point rounding. Indian digit grouping implemented
  in `formatMoney` (last 3 digits, then groups of 2).
- **Alternatives rejected**: floating-point rupees (rounding error, violates FR-012);
  `Intl.NumberFormat('en-IN')` (output differs across Hermes versions).

## R6. Record-number sequences

- **Decision**: Table `number_sequences(kind, year, last_value)`. Issuing a number runs, inside
  the creating transaction: `INSERT … ON CONFLICT (kind, year) DO UPDATE SET last_value =
  last_value + 1 RETURNING last_value`. The row lock serialises concurrent issuers; a rolled-back
  transaction releases its number with the rollback, so no gaps from clashes and no reuse
  (SC-007). Year = IST calendar year of creation. Item codes (not yearly) use `year = 0`.
- **Item code changes** (clarification): an `item_codes` table (delivered in 003) records every
  code an item has had, with a unique constraint across all of them. 001 only provides the
  sequence and the `formatRecordNumber` helper; the history table ships with items in 003.
- **Alternatives rejected**: PostgreSQL `SEQUENCE` per kind/year (sequences are not
  transactional — rollbacks leave gaps — and need DDL each new year).

## R7. API versioning and the forced-update check

- **Decision**: All endpoints under `/api/v1/`. Every app sends `X-Client-Platform`
  (`web` | `android` | `ios`) and `X-Client-Version` (semver). Middleware compares mobile versions
  with `mobile_version_settings`; below minimum → HTTP **426** with error code
  `APP_UPDATE_REQUIRED` and the store link. A separate unauthenticated
  `GET /api/v1/app-version?platform=` lets the app check on launch and on foreground before
  signing in. Settings are read from the database on every check (cached ≤ 30 s in memory), so a
  Super Admin change applies without a release (FR-030/031).
- **Alternatives rejected**: Expo Updates / store-only update prompts (cannot block old native
  binaries; store prompts are not controllable by the Super Admin).

## R8. Health checks

- **Decision**: A pg-boss heartbeat job runs every 30 s and records `last_heartbeat_at`.
  The status endpoint checks: database (`SELECT 1`, 2 s timeout), file storage (HeadBucket on the
  S3-compatible bucket, 2 s timeout), background work (heartbeat younger than 90 s). Results are
  computed live per request with a 10 s memo, so a failure shows within 1 minute (SC-006).
  Public `GET /api/health` returns `{ "status": "up" | "down" }` only; "down" when the database is
  unreachable (the app cannot serve anything useful without it).
- **Alternatives rejected**: external monitoring only (does not satisfy the in-app status page).

## R9. Module map and permissions as code

- **Decision**: The module map (id, label key, roles, apps, shipped flag) and the role →
  permission table live as typed constants in `packages/shared`. The API computes the menu for
  `GET /api/v1/me`; both apps render that list. The API enforces permissions with a
  `requirePermission()` guard on every handler, independent of the menu (FR-009).
- **Rationale**: Modules change only when a feature ships — a code change anyway. A database
  table would add an admin screen nobody needs (constitution VI).

## R10. Unsaved work survives a session ending

- **Decision**: `packages/shared` defines a `DraftStore` interface (keyed by user id + form key)
  with implementations on `localStorage` (web) and `AsyncStorage` (mobile). The shell saves the
  return path and any registered form draft when a request fails with `SESSION_EXPIRED`, and
  restores both after sign-in (FR-005a). Later features register their forms with it.

## R11. Strings and localisation readiness

- **Decision**: One English catalogue `packages/shared/i18n/en.ts` (typed keys) and a tiny `t()`
  helper; no i18n framework yet (constitution VI). All UI text goes through `t()`; a lint rule
  (eslint `react/jsx-no-literals` on app UI folders) blocks hard-coded strings.

## R12. Testing stack

- **Decision**: Vitest for `packages/shared` and API route handlers (against a real PostgreSQL
  from Docker Compose); contract tests parse every handler response with its zod schema;
  Playwright for web end-to-end flows; Jest (`jest-expo`) + React Native Testing Library for
  mobile screens. Typecheck (`tsc --noEmit`) and ESLint across all workspaces in CI
  (GitHub Actions).
- **Rationale**: Same tools as Service Management for web and API; `jest-expo` is the supported
  runner for Expo apps.

## R13. Local and production infrastructure

- **Decision**: Docker Compose with `postgres:15-alpine`, `minio`, and the web app container
  (same pattern as Service Management). Mobile builds use EAS Build with internal distribution
  (Play internal testing, TestFlight) for this feature; store release is feature 011.
