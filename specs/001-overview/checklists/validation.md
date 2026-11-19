# Validation record: 001-overview

**Date**: 2026-11-19 · **Build**: web 0.1.0, mobile 0.1.0 (Expo SDK 52)

## Automated (all passing)

| Suite | Result |
| --- | --- |
| `packages/shared` unit tests (menu builder, every display-conventions row) | 32 / 32 |
| `apps/web` integration + contract tests (real PostgreSQL) | 48 / 48 |
| `apps/mobile` jest-expo tests (sign-in, menu, session-expiry return path, conventions under UTC−8, version gate) | 9 / 9 |
| `apps/web` Playwright e2e (Chromium, production build) | 6 / 6 |
| Typecheck (all workspaces) · ESLint (`--max-warnings=0`) | pass · pass |
| Metro production bundles (Hermes) | Android 2.69 MB · iOS 2.69 MB |

## Quickstart scenarios

| # | Scenario | Status | How verified |
| --- | --- | --- | --- |
| 1 | Web sign-in as owner; home + menu | ✅ | e2e `Super Admin signs in…` |
| 2 | Same menu on Android and iOS minus web-only | ✅ (logic) · ⏳ device | contract test (`menu omits web-only modules on mobile`), jest-expo home test; real-device check pending |
| 3 | Return to requested page after sign-in | ✅ | e2e |
| 4 | Lockout after 5 failures, generic message before | ✅ | integration `lockout.test.ts`, e2e generic message |
| 5 | Reference sample screen on all three apps | ✅ web · ✅ mobile (test renderer) · ⏳ device | e2e + jest-expo |
| 6 | Device time zone UTC−8 → times unchanged | ✅ | jest-expo with `TZ=America/Los_Angeles` |
| 7 | Web idle 60 min → sign-in → back to page | ✅ | integration `sessions.test.ts` (sliding expiry) + e2e return-to |
| 8 | Android minimum above installed → blocking screen | ✅ (API 426 + hook) · ⏳ device | integration `version-gate.test.ts`, jest-expo `update.test.tsx` |
| 9 | Only recommended above → prompt once a day | ✅ · ⏳ device | jest-expo |
| 10 | Storage down → File storage Down, overall Degraded | ✅ | integration `health.test.ts` (MinIO not running in this environment, so the live page also shows File storage Down) |
| 11 | `GET /api/health` → `{"status":"up"}` only | ✅ | contract `health.test.ts` |

⏳ = needs a real Android phone and iPhone (Expo Go or an internal build from `eas build --profile preview`). Not possible in the build environment.

## Performance (T070)

Production build, 4 vCPU, local PostgreSQL 16, 50 concurrent clients:

| Endpoint | p50 | p95 | Target |
| --- | --- | --- | --- |
| `GET /api/v1/me` (read, session check) | 59 ms | 122 ms | ≤ 500 ms ✅ |
| `GET /api/v1/app-version` (read) | 43 ms | 76 ms | ≤ 500 ms ✅ |
| `POST /api/v1/auth/sign-in`, 1 at a time | 224 ms | 281 ms | ≤ 1 s ✅ |
| `POST /api/v1/auth/sign-in`, 5 at once | 239 ms | 451 ms | ≤ 1 s ✅ |
| `POST /api/v1/auth/sign-in`, 50 at once | 2.8 s | 2.9 s | ≤ 1 s ❌ |

The 50-simultaneous sign-in burst misses the write target: bcrypt cost 12 (constitution minimum) is CPU-bound, about 220 ms per sign-in per core. With 50 users in total, 50 sign-ins in the same second is not a realistic load, but it is recorded as a known limit; a 4+ vCPU server keeps realistic bursts under 1 s.

SC-008 (home ≤ 3 s on 4G mid-range Android) needs a device and is pending with the device checks above.
