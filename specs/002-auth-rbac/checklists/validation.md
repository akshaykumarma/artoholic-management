# Validation record: 002-auth-rbac

**Date**: 2026-11-19

## Automated (all passing)

| Suite | Result |
| --- | --- |
| `packages/shared` (menu, formats, phone normalisation, password policy) | 46 / 46 |
| `apps/web` integration + contract (real PostgreSQL), incl. one test per permission-matrix cell (92) | 181 / 181 |
| `apps/mobile` jest-expo (sign-in, menu, session expiry, conventions, version gate, biometric gate, user admin, forgot password) | 17 / 17 |
| `apps/web` Playwright e2e (production build) | 7 / 7 |
| Typecheck · ESLint `--max-warnings=0` · Android Metro bundle | pass · pass · 3.04 MB |

## Quickstart scenarios

| # | Scenario | Status | Verified by |
| --- | --- | --- | --- |
| 1 | Super Admin creates Admin; Admin creates a two-role user with phone only | ✅ | `users-create.test.ts`, e2e `users.spec.ts` |
| 2 | Duplicate phone typed differently → `IDENTIFIER_TAKEN` on phone | ✅ | `users-create.test.ts` |
| 3 | Sign in by phone with temp password → forced change only | ✅ | `sign-in-identifiers.test.ts`, e2e |
| 4 | Forgot password: generic message, same code by WhatsApp and email, code redacted | ✅ (dev channel) | `password-reset.test.ts`, e2e |
| 5 | 5 wrong codes → refused | ✅ | `password-reset.test.ts` |
| 6 | Deactivate → phone session refused on next request | ✅ (API) · ⏳ device | `users-status.test.ts`, e2e (web session) |
| 7 | Sole Admin removing own Admin role → `LAST_ADMIN` | ✅ | `users-status.test.ts` |
| 8 | Biometric prompt after > 5 min in background | ✅ (component) · ⏳ device | `biometric.test.tsx` |
| 9 | Permission-matrix suite | ✅ 92 cells | `permission-matrix.test.ts` |

⏳ = needs a real phone. WhatsApp and email go to the development outbox (`dev_outbox`) until 008 connects the real providers.
