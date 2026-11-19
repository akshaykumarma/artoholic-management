# Implementation Plan: Platform Overview, Conventions & App Shell

**Branch**: `001-overview` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-overview/spec.md`

## Summary

Lay the foundation every later feature (002–011) plugs into: a monorepo holding a Next.js web
app that also serves the versioned `/api/v1`, an Expo React Native app for Android and iOS, and a
shared TypeScript package with the API contracts, display conventions, module map, permissions
and English strings. Delivered behaviour: Super Admin sign-in on all three apps with role-aware
menus, sessions (web 60-minute idle, mobile 30-day), sign-in lockout and audit, record-number
sequences, mobile forced/recommended update, and a Super Admin status page plus a public health
check. Research decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (web/API); TypeScript on React Native via
Expo SDK (current stable at implementation time) for mobile

**Primary Dependencies**: Next.js 14 (App Router), Drizzle ORM + `pg`, `bcrypt`, `zod`,
`pg-boss`, `@aws-sdk/client-s3`; Expo + Expo Router, `expo-secure-store`,
`@react-native-async-storage/async-storage`

**Storage**: PostgreSQL 15 (Docker Compose); S3-compatible object storage (MinIO locally) —
only health-checked in this feature

**Testing**: Vitest (shared package, API handlers and contract tests against real PostgreSQL),
Playwright (web end-to-end), Jest via `jest-expo` + React Native Testing Library (mobile)

**Target Platform**: Linux server in Docker behind TLS; browsers: last 2 versions of Chrome,
Edge, Safari, Firefox; Android 9+ (API 28); iOS 15+

**Project Type**: Mobile + API monorepo (web app and API in one Next.js deployable; one Expo app)

**Performance Goals**: API p95 ≤ 500 ms reads / ≤ 1 s writes at 50 concurrent users; home
screen < 3 s on 4G mid-range Android (SC-008); session check is one indexed lookup per request

**Constraints**: TLS 1.2+; bcrypt ≥ 12; HttpOnly + Secure cookies; CSRF on web state changes;
tokens in Keychain/Keystore; lockout 5 failures / 15 min; IST display from UTC storage on every
device; identical formatting on all three apps (no device Intl time zones)

**Scale/Scope**: 50 users; ~7 screens in this feature (sign-in, home, status, mobile-version
settings, reference sample screen, update-required, access-denied); 7 tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Tasks put failing tests first for: lockout, session expiry (web sliding / mobile fixed), role-union menu, permission guard, sequence issuing under concurrency (SC-007), every display-conventions row, version gate (426). | Pass |
| II. Ledger is the source of truth | No stock yet. `audit_entries` is append-only with the DB role denied UPDATE/DELETE; sequences never reuse numbers. | Pass |
| III. One API contract for three apps | All endpoints under `/api/v1`; zod schemas in `packages/shared/contracts` used by handler and client; contract tests per endpoint; 426 gate for old mobile builds. | Pass |
| IV. Field-first mobile | Mobile shell: one-handed layout, 44 pt targets; drafts and return path kept when a session ends (`DraftStore`). Photo compression not applicable yet. | Pass |
| V. Security, privacy & audit | Server-side `requirePermission` on every handler; audit on sign-in/failed/sign-out/settings; CSRF; secure token storage; generic sign-in error; no secrets in repo (`.env.example` only). | Pass |
| VI. Simplicity | One deployable for web + API; module map and permissions as code constants; no i18n framework, no Turborepo, no Auth.js adapters. | Pass |
| Non-functional service levels | Performance, compatibility, accessibility (WCAG 2.1 AA web; RN accessibility labels), localisation (string catalogue), observability (structured JSON logs; error tracking wired via env), availability (health endpoint). Backups/retention jobs belong to 010. | Pass |
| Technology & domain constraints | Stack exactly as ratified; IST/₹/DD-MM-YYYY conventions centralised in `packages/shared/format`. | Pass |

**Post-design re-check (after Phase 1)**: Pass — the data model keeps audit append-only, the
contracts version every endpoint, and no abstraction beyond the three workspaces was added.

## Project Structure

### Documentation (this feature)

```text
specs/001-overview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-v1.md
│   └── display-conventions.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
package.json                 # npm workspaces: apps/*, packages/*; root scripts
tsconfig.base.json
.eslintrc.cjs
docker-compose.yml           # db (postgres:15-alpine), minio, web
.env.example
.github/workflows/ci.yml     # typecheck, lint, unit + contract tests (postgres service), e2e

packages/shared/
├── src/
│   ├── contracts/           # zod schemas + types: errors, auth, me, app-version, admin-status, mobile-versions
│   ├── api-client/          # typed fetch client (headers, CSRF, bearer, 426/401 handling)
│   ├── format/              # date-time IST, money (paise), quantity, phone, record-number
│   ├── modules/             # module map + menu builder
│   ├── auth/                # roles, permissions, ROLE_PERMISSIONS
│   ├── drafts/              # DraftStore interface
│   ├── i18n/                # en.ts catalogue + t()
│   └── index.ts
└── tests/

apps/web/
├── app/
│   ├── (auth)/sign-in/page.tsx
│   ├── (shell)/layout.tsx
│   ├── (shell)/page.tsx
│   ├── (shell)/admin/status/page.tsx
│   ├── (shell)/reference/conventions/page.tsx
│   ├── api/health/route.ts
│   └── api/v1/
│       ├── app-version/route.ts
│       ├── auth/sign-in/route.ts
│       ├── auth/sign-out/route.ts
│       ├── me/route.ts
│       └── admin/{status,mobile-versions/[platform]}/route.ts
├── middleware.ts            # client headers, version gate, CSRF check
├── db/{schema.ts,migrations/,migrate.ts}
├── server/{auth,audit,sequences,health,jobs,http}/
├── scripts/seed-super-admin.ts
└── tests/{contract,integration,e2e}/

apps/mobile/
├── app/                     # Expo Router: _layout, sign-in, update-required, (shell)/…
├── src/                     # secure token store, AsyncStorage DraftStore, api client wiring
├── app.config.ts
├── eas.json                 # internal distribution profiles
└── tests/
```

**Structure Decision**: npm-workspaces monorepo with `apps/web` (UI + API in one Next.js
deployable, as in Service Management), `apps/mobile` (one Expo app for Android and iOS) and
`packages/shared` (contracts and conventions shared by both). This layout binds features
002–011: each adds its tables to `apps/web/db`, handlers under `apps/web/app/api/v1/<module>`,
server logic under `apps/web/server/<module>`, screens in both apps, and its contracts,
permissions and module-map entry in `packages/shared`.

## Complexity Tracking

No constitution violations to justify.
