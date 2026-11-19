# Implementation Plan: Users, Roles & Sign-in

**Branch**: `002-auth-rbac` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-auth-rbac/spec.md`

## Summary

Extend 001's Super-Admin-only shell into full account management: Admin-created users with
multiple roles and warehouse assignments, sign-in by username/email/phone, forced change of
temporary passwords, OTP password reset over WhatsApp and email, deactivation that revokes every
session at once, mobile biometric unlock, and the binding permission matrix enforced server-side
by 001's `requirePermission` guard. Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: As 001 — TypeScript 5.x, Node.js 20 LTS; Expo React Native

**Primary Dependencies**: 001 stack plus `libphonenumber-js` (phone normalisation, shared by
web and mobile), `expo-local-authentication` (biometrics); a bundled top-10,000 common-password
list in `packages/shared`

**Storage**: PostgreSQL — extends `users`, `user_roles`, `sessions`; adds
`warehouse_assignments`, `password_resets`

**Testing**: Vitest integration tests per permission-matrix cell; contract tests per endpoint;
Playwright for create-user, forced change, reset; jest-expo for biometric gate

**Target Platform**: As 001

**Project Type**: As 001 (monorepo: `apps/web`, `apps/mobile`, `packages/shared`)

**Performance Goals**: Sign-in p95 ≤ 1 s (bcrypt cost 12 dominates); identifier lookup is one
indexed query; deactivation revokes sessions in one statement (SC-003 ≤ 5 s)

**Constraints**: Generic errors (no account enumeration); OTP 6 digits, 10 min, 5 attempts,
3/hour, stored hashed; codes redacted in all logs; only Super Admin touches Admins; last-Admin
and self-deactivation guards

**Scale/Scope**: ≤ 50 users; 8 screens per app (users list, user form, user detail, sign-in,
forced change, forgot, reset, security settings)

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Failing tests first for: identifier resolution, username default rules, uniqueness across identifiers, every permission-matrix cell, OTP limits/expiry, session revocation on deactivation/reset, last-Admin guard. | Pass |
| II. Ledger | Not applicable (no stock); user history kept via append-only audit. | Pass |
| III. One API contract | New endpoints under `/api/v1/users`, `/api/v1/auth/*`; zod schemas in `packages/shared/contracts/users.ts`, `auth.ts`; contract tests. | Pass |
| IV. Field-first mobile | Sign-in by phone; biometric unlock; reset on phone without Admin. | Pass |
| V. Security & audit | bcrypt 12; hashed OTPs; identical responses for unknown identifiers; audit every user change; codes redacted; tokens in secure store. | Pass |
| VI. Simplicity | Permissions stay code constants; no external identity provider. | Pass |
| Service levels | Notification latency for OTP via 008 providers (dev mock until then). | Pass |

**Post-design re-check**: Pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-rbac/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/api-users-auth.md
└── checklists/requirements.md
```

### Source Code (extends 001 layout)

```text
packages/shared/src/
├── auth/permissions.ts          # full matrix from spec (Permission union + ROLE_PERMISSIONS)
├── auth/password-policy.ts      # rules + common-password list
├── contracts/{users,auth}.ts
└── format/phone.ts              # normalise via libphonenumber-js, default +91
apps/web/
├── db/schema.ts                 # + warehouse_assignments, password_resets, users columns
├── server/users/                # create, update, deactivate, reactivate, guards
├── server/auth/                 # identifier resolution, reset, forced change, revoke-all
├── app/api/v1/users/...         # list, create, get, update, deactivate, reactivate, temp-password
├── app/api/v1/auth/{forgot,reset,change-password}/route.ts
└── app/(shell)/users/...        # list, new, [id]
apps/mobile/app/
├── (auth)/{forgot,reset,change-password}.tsx
├── (shell)/users/...            # Admin screens
└── (shell)/settings/security.tsx  # biometric toggle
```

**Structure Decision**: Follows 001's binding layout; permission enforcement is the existing
`requirePermission` guard plus a new `requireWarehouseScope` helper used from 004 onwards.

## Complexity Tracking

No violations.
