---
description: "Task list for 011-mobile-release"
---

# Tasks: Mobile App Store Release

**Input**: `specs/011-mobile-release/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–010 complete; store accounts (PRD D2).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Confirm app name and bundle/package id with the owner; set them in `apps/mobile/app.config.ts` (default proposal `in.artoholic.ops`) — confirmed by the owner 2026-11-20
- [X] T002 [P] EAS `production` profile, `appVersionSource: remote`, `autoIncrement` in `apps/mobile/eas.json`
- [ ] T003 [P] Upload FCM v1 key and APNs .p8 to Expo (no secrets in repo); document in `docs/runbooks/mobile-release.md` — **open: owner uploads keys to Expo — steps in docs/runbooks/mobile-release.md**

## Phase 2: Foundational

- [X] T004 Migration: `app_releases`, `release_checks`, `account_deletion_requests` in `apps/web/db/schema.ts`
- [X] T005 [P] Store listing sources (text, screenshots, privacy answers) in `apps/mobile/store/{listing.md,privacy.md}` and public page `apps/web/app/privacy/page.tsx`

## Phase 3: US1 — Install from the stores (P1) 🎯 MVP

- [ ] T006 [US1] Build and submit production builds; create listings under Artoholic accounts; verify install on Android 9 and iOS 15 devices — **open: needs Artoholic store accounts and devices**

## Phase 4: US2 — Every release tested first (P1)

- [X] T007 [P] [US2] Contract tests `/api/v1/admin/releases*` in `apps/web/tests/contract/releases.test.ts`
- [X] T008 [US2] Release records + checklist routes `apps/web/app/api/v1/admin/releases/{route,[id]/route,[id]/checks/route}.ts`; screen `apps/web/app/(shell)/admin/releases/page.tsx`
- [X] T009 [P] [US2] GitHub Actions `.github/workflows/mobile-release.yml` (tag `mobile-v*` → EAS build + submit to internal tracks)

## Phase 5: US3 — Retire old versions safely (P1)

- [X] T010 [P] [US3] Tests: minimum raise refused (`VERSION_NOT_LIVE`) unless a live release ≥ that version exists on the platform in `apps/web/tests/integration/version-retire.test.ts`
- [X] T011 [US3] Gate in `apps/web/server/versions/settings.ts` (from 001)

## Phase 6: US4 — Production push (P1)

- [ ] T012 [US4] Verify production push on both platforms (damage report → Admin phone ≤ 30 s); record in release checks — **open: needs production builds and phones**

## Phase 7: US5 — Privacy and account deletion (P2)

- [X] T013 [P] [US5] Tests: pseudonymisation of every personal column, attribution kept, sessions/push tokens removed, 30-day due in `apps/web/tests/integration/deletion-requests.test.ts`
- [X] T014 [US5] Routes `apps/web/app/api/v1/me/deletion-request/route.ts`, `apps/web/app/api/v1/admin/deletion-requests/{route,[id]/complete/route}.ts`; service `apps/web/server/deletion-requests/pseudonymise.ts`
- [X] T015 [P] [US5] Mobile `apps/mobile/app/(shell)/settings/delete-account.tsx`; just-in-time permission prompts (camera, photos, location, notifications) with explanations and refusal fallbacks; jest-expo tests `apps/mobile/tests/permissions.test.tsx`

## Phase 8: Polish

- [ ] T016 Complete the release checklist for both platforms and run quickstart 1–6; record in `specs/011-mobile-release/checklists/validation.md` — **open: needs real devices; the code-side quickstart is recorded in validation.md**

## Dependencies & Strategy

Phase 2 blocks all. US2 and US3 before the first public promotion (US1); US4 verified with it;
US5 required by Apple review, so it ships with the first public release.
