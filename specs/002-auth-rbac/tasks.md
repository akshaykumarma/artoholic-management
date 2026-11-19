---
description: "Task list for 002-auth-rbac"
---

# Tasks: Users, Roles & Sign-in

**Input**: `specs/002-auth-rbac/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001 complete.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `libphonenumber-js` to `packages/shared` and `expo-local-authentication` to `apps/mobile`; add common-password list `apps/web/server/auth/common-passwords.txt` (top 10,000, SecLists, MIT)

## Phase 2: Foundational

- [X] T002 Migration: extend `users` (phone NOT NULL UNIQUE, must_change_password, password_changed_at, deactivated_at/by, pseudonymised_at), add `warehouse_assignments`, `password_resets`, `sessions.biometric_enabled` in `apps/web/db/schema.ts` + `apps/web/db/migrations/`
- [X] T003 [P] Phone normaliser (default IN) with tests in `packages/shared/src/format/phone-normalise.ts` and `packages/shared/tests/phone-normalise.test.ts`
- [X] T004 [P] Full permission matrix from spec as `Permission` union + `ROLE_PERMISSIONS` in `packages/shared/src/auth/permissions.ts`
- [X] T005 [P] Generated matrix test (one case per role × capability) in `apps/web/tests/integration/permission-matrix.test.ts`
- [X] T006 [P] `requireWarehouseScope(user, warehouseId)` guard in `apps/web/server/auth/guards.ts` with tests in `apps/web/tests/integration/scope.test.ts`
- [X] T007 [P] zod schemas `packages/shared/src/contracts/users.ts` and extend `packages/shared/src/contracts/auth.ts` (identifier sign-in, change, forgot, reset)
- [X] T008 [P] `NotificationChannel` interface + dev mock (WhatsApp/email outbox tables `dev_outbox`) in `apps/web/server/notifications/dev-mock.ts` (replaced by 008)

## Phase 3: US1 — Admin creates staff accounts with roles (P1) 🎯 MVP

- [X] T009 [P] [US1] Tests: username default (email → phone), uniqueness across username/email/phone (normalised), Admin role only by Super Admin, union permissions in `apps/web/tests/integration/users-create.test.ts`
- [X] T010 [P] [US1] Contract tests `GET/POST /api/v1/users`, `GET /api/v1/users/{id}` in `apps/web/tests/contract/users.test.ts`
- [X] T011 [US1] Identifier uniqueness check + user creation service (audit `user.created`) in `apps/web/server/users/create.ts`
- [X] T012 [US1] Routes `apps/web/app/api/v1/users/route.ts` and `apps/web/app/api/v1/users/[id]/route.ts` (GET)
- [ ] T013 [P] [US1] Web Users list + new-user form (roles, warehouses picker hidden until 004) `apps/web/app/(shell)/users/page.tsx`, `apps/web/app/(shell)/users/new/page.tsx`
- [ ] T014 [P] [US1] Mobile Users list + form `apps/mobile/app/(shell)/users/index.tsx`, `apps/mobile/app/(shell)/users/new.tsx`
- [X] T015 [US1] Register `users` module as shipped in `packages/shared/src/modules/index.ts`

## Phase 4: US2 — Sign in with username, email or phone (P1)

- [X] T016 [P] [US2] Tests: identifier resolution (email/phone/username forms), deactivated → generic error, forced change blocks other endpoints with `PASSWORD_CHANGE_REQUIRED` in `apps/web/tests/integration/sign-in-identifiers.test.ts`
- [X] T017 [US2] Identifier resolver in `apps/web/server/auth/identifier.ts`; update sign-in route `apps/web/app/api/v1/auth/sign-in/route.ts`
- [X] T018 [US2] Password policy (length, not username/phone/email, not common) in `packages/shared/src/auth/password-policy.ts` with tests `packages/shared/tests/password-policy.test.ts`; the 10,000-entry common list stays on the server (`apps/web/server/auth/common-passwords.txt`, checked by `apps/web/server/auth/policy.ts`)
- [X] T019 [US2] Change-password route + forced-change guard in `apps/web/app/api/v1/auth/change-password/route.ts` and `apps/web/server/auth/guards.ts`
- [ ] T020 [P] [US2] Forced-change screens `apps/web/app/(auth)/change-password/page.tsx`, `apps/mobile/app/(auth)/change-password.tsx`

## Phase 5: US3 — Forgotten password reset by one-time code (P1)

- [X] T021 [P] [US3] Tests: generic response, HMAC storage, 10-min expiry, 5 attempts, 3/hour/account, revoke all sessions, redaction in outbox/audit in `apps/web/tests/integration/password-reset.test.ts`
- [X] T022 [P] [US3] Contract tests `POST /api/v1/auth/forgot`, `POST /api/v1/auth/reset` in `apps/web/tests/contract/reset.test.ts`
- [X] T023 [US3] Reset service in `apps/web/server/auth/reset.ts`; routes `apps/web/app/api/v1/auth/forgot/route.ts`, `apps/web/app/api/v1/auth/reset/route.ts`
- [ ] T024 [P] [US3] Forgot/reset screens `apps/web/app/(auth)/forgot/page.tsx`, `apps/web/app/(auth)/reset/page.tsx`, `apps/mobile/app/(auth)/forgot.tsx`, `apps/mobile/app/(auth)/reset.tsx`

## Phase 6: US4 — Deactivate and reactivate (P2)

- [X] T025 [P] [US4] Tests: deactivation revokes all sessions in one transaction, names kept on history, `LAST_ADMIN`, `SELF_DEACTIVATION`, reactivation sets temp password in `apps/web/tests/integration/users-status.test.ts`
- [X] T026 [US4] Status service in `apps/web/server/users/status.ts`; routes `apps/web/app/api/v1/users/[id]/deactivate/route.ts`, `apps/web/app/api/v1/users/[id]/reactivate/route.ts`
- [ ] T027 [P] [US4] Deactivate/reactivate actions on user detail `apps/web/app/(shell)/users/[id]/page.tsx`, `apps/mobile/app/(shell)/users/[id].tsx`

## Phase 7: US6 — Admin edits details and roles (P2)

- [X] T028 [P] [US6] Tests: role removal effective next request, temp-password reset revokes sessions, audit with before/after (no secrets), `If-Match` concurrency in `apps/web/tests/integration/users-update.test.ts`
- [X] T029 [US6] Update and temp-password services in `apps/web/server/users/update.ts`; routes `apps/web/app/api/v1/users/[id]/route.ts` (PATCH), `apps/web/app/api/v1/users/[id]/temporary-password/route.ts`
- [ ] T030 [P] [US6] Edit form `apps/web/app/(shell)/users/[id]/edit/page.tsx`, `apps/mobile/app/(shell)/users/[id]/edit.tsx`; list search/filters (FR-015)

## Phase 8: US5 — Biometric unlock on phones (P3)

- [ ] T031 [P] [US5] jest-expo tests: prompt after > 5 min background, 3 failures → password, hidden without enrolment in `apps/mobile/tests/biometric.test.tsx`
- [ ] T032 [US5] Biometric gate `apps/mobile/src/auth/BiometricGate.tsx`, toggle `apps/mobile/app/(shell)/settings/security.tsx`, route `apps/web/app/api/v1/auth/biometric/route.ts`

## Phase 9: Polish

- [ ] T033 [P] Playwright journey: create user → forced change → reset → deactivate in `apps/web/tests/e2e/users.spec.ts`
- [ ] T034 Run quickstart scenarios 1–9 and record in `specs/002-auth-rbac/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 → US2 → US3 (MVP). US4 and US6 after US1; US5 after US2. Tests in
each phase can be written in parallel. MVP = US1–US3; then US4, US6, US5.
