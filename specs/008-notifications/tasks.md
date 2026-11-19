---
description: "Task list for 008-notifications"
---

# Tasks: Notifications & Message Log

**Input**: `specs/008-notifications/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — constitution principle I. Each test task is written and seen failing
before its implementation task.

**Paths**: 001 monorepo — `apps/web`, `apps/mobile`, `packages/shared`. **Depends on**: 001–007 complete (replaces their dev mocks).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Add `expo-server-sdk`, `nodemailer`, `tweetnacl` to `apps/web`; `expo-notifications` to `apps/mobile`; Mailpit service in `docker-compose.yml`; env keys in `.env.example` (WHATSAPP_PROVIDER, SMTP_*, SETTINGS_ENCRYPTION_KEY)

## Phase 2: Foundational

- [ ] T002 Migration: `notification_outbox`, `notifications`, `messages`, `message_events` (append-only grants), `channel_preferences`, `quiet_hours`, `push_registrations`, `template_mappings`, `provider_settings` in `apps/web/db/schema.ts`
- [ ] T003 [P] Trigger catalogue (spec table: recipients rule, group, default channels, bypassQuietHours, secret params) in `packages/shared/src/notifications/triggers.ts`; deep links `packages/shared/src/notifications/deeplinks.ts`
- [ ] T004 [P] Redaction with property tests (no 6-digit code survives for `auth.*`) in `apps/web/server/notifications/redact.ts`, `apps/web/tests/unit/redact.test.ts`
- [ ] T005 `emit(tx, trigger, payload)` outbox writer `apps/web/server/notifications/emit.ts`; replace 002–007 dev-mock calls with `emit`
- [ ] T006 Dispatcher: recipients → preferences → per-channel jobs, de-dup 60 s, quiet-hours deferral in `apps/web/server/notifications/{dispatcher,dedupe,quiet-hours}.ts` with tests `apps/web/tests/integration/dispatcher.test.ts`

## Phase 3: US1 — Right people told at each step (P1) 🎯 MVP

- [ ] T007 [P] [US1] Tests: one notification per recipient per channel for every trigger in the catalogue; actor gets in-app only in `apps/web/tests/integration/triggers.test.ts`
- [ ] T008 [US1] Push channel (Expo) with receipt polling `apps/web/server/notifications/channels/push.ts`; registration route `apps/web/app/api/v1/me/push-registrations/route.ts`
- [ ] T009 [US1] WhatsApp adapter interface + Cloud API + mock `apps/web/server/notifications/providers/{whatsapp-cloud,whatsapp-mock}.ts`; channel `…/channels/whatsapp.ts`
- [ ] T010 [US1] Email via SMTP `apps/web/server/notifications/providers/smtp.ts`, `…/channels/email.ts`
- [ ] T011 [P] [US1] Mobile push setup + deep-link routing after sign-in `apps/mobile/src/push/{register,handle}.ts`; jest-expo test `apps/mobile/tests/push-deeplink.test.tsx`

## Phase 4: US2 — Notification centre (P1)

- [ ] T012 [P] [US2] Contract tests `/api/v1/notifications*` in `apps/web/tests/contract/notifications.test.ts`
- [ ] T013 [US2] Routes `apps/web/app/api/v1/notifications/{route,unread-count/route,[id]/read/route,read-all/route}.ts`; 90-day purge job
- [ ] T014 [P] [US2] Centre UI with unread badge `apps/web/app/(shell)/notifications/page.tsx`, `apps/mobile/app/(shell)/notifications.tsx`; mark `notifications` module shipped

## Phase 5: US5 — Permanent message log (P1)

- [ ] T015 [P] [US5] Tests: every WhatsApp/email logged with full redacted text; status events from webhook; retries 3× over ~15 min then Super Admin alert in `apps/web/tests/integration/message-log.test.ts`
- [ ] T016 [US5] Webhook with signature verification `apps/web/app/api/webhooks/whatsapp/route.ts`; retry policy in channels
- [ ] T017 [US5] Record message routes `apps/web/app/api/v1/records/[type]/[id]/messages/route.ts`, `apps/web/app/api/v1/admin/messages/route.ts`; show in event activity (006 activity tab)

## Phase 6: US3 — Channel choices and quiet hours (P2)

- [ ] T018 [P] [US3] Tests in `apps/web/tests/integration/preferences.test.ts`
- [ ] T019 [US3] Route `apps/web/app/api/v1/me/notification-preferences/route.ts`; settings screens `apps/web/app/(shell)/settings/notifications/page.tsx`, `apps/mobile/app/(shell)/settings/notifications.tsx`

## Phase 7: US4 — Super Admin providers and templates (P2)

- [ ] T020 [P] [US4] Tests: secrets encrypted and write-only; missing template → WhatsApp skipped, others sent; test send logged in `apps/web/tests/integration/providers.test.ts`
- [ ] T021 [US4] Routes `apps/web/app/api/v1/admin/providers/[channel]/{route,test/route}.ts`, `apps/web/app/api/v1/admin/template-mappings/route.ts`; screens `apps/web/app/(shell)/admin/integrations/…`

## Phase 8: Polish

- [ ] T022 Latency measurement (queued → accepted) and alert if SC-001 breached; run quickstart 1–7; record in `specs/008-notifications/checklists/validation.md`

## Dependencies & Strategy

Phase 2 blocks all. US1 → US2 → US5 = MVP; US3, US4 after. Wiring `emit` into 002–007 (T005)
is the first change to land.
