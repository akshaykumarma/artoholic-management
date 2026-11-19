# Implementation Plan: Notifications & Message Log

**Branch**: `008-notifications` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-notifications/spec.md`

## Summary

One notification pipeline: modules emit domain triggers → a dispatcher resolves recipients and
preferences → per-channel jobs deliver in-app (immediately), push (Expo Push service → FCM/APNs),
WhatsApp (Cloud API templates, documents) and email (SMTP) with retries, quiet hours and
de-duplication. Every WhatsApp/email message is written to a permanent message log (codes
redacted) shown in record activity. Replaces the dev mocks used by 002–007. Decisions:
[research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001

**Primary Dependencies**: pg-boss (queues, retries); `expo-server-sdk` (push);
WhatsApp Business Cloud API over HTTPS (provider adapter; mock adapter for dev/test, as in
Service Management); `nodemailer` (SMTP); `expo-notifications` (mobile); encrypted settings
via libsodium sealed boxes (`tweetnacl`)

**Storage**: PostgreSQL — `notifications`, `messages`, `message_events`,
`channel_preferences`, `quiet_hours`, `push_registrations`, `template_mappings`,
`provider_settings`

**Testing**: Vitest — recipient resolution per trigger, de-dup within 60 s, quiet-hour
deferral and Admin-damage bypass, redaction (property test: no 6-digit code survives), retry
schedule; webhook signature verification; contract tests; jest-expo deep links

**Performance Goals**: In-app and push ≤ 30 s, WhatsApp/email accepted ≤ 2 min (SC-001)

**Constraints**: Message log permanent and append-only; OTPs never stored in clear in logs;
provider secrets encrypted at rest, write-only in UI

**Scale/Scope**: ≈ 5,000 notifications/day peak

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Recipient, preference, de-dup, quiet hours, redaction and retry tests first. | Pass |
| II. Ledger | Not stock; message log is append-only (status changes as `message_events`). | Pass |
| III. One API contract | `/api/v1/notifications/*`, `/api/v1/me/preferences`, admin settings; push payload schema shared. | Pass |
| IV. Field-first mobile | Push deep links into the exact record; works after sign-in. | Pass |
| V. Security & audit | Encrypted provider secrets; webhook signature checks; redaction; owner rule on permanent log. | Pass |
| VI. Simplicity | One dispatcher and four channel adapters; templates mapped, not authored. | Pass |
| Service levels | Notification latency targets measured per message (`queued_at → accepted_at`). | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/008-notifications/ (plan, research, data-model, quickstart, contracts/api-notifications.md)

packages/shared/src/notifications/{triggers,groups,deeplinks}.ts   # trigger catalogue = spec table
packages/shared/src/contracts/notifications.ts
apps/web/server/notifications/
├── dispatcher.ts            # trigger → recipients → per-channel jobs
├── channels/{inapp,push,whatsapp,email}.ts
├── providers/{whatsapp-cloud,whatsapp-mock,smtp}.ts
├── redact.ts · quiet-hours.ts · dedupe.ts
apps/web/app/api/v1/notifications/… · app/api/webhooks/whatsapp/route.ts
apps/web/app/(shell)/notifications/… · (shell)/settings/notifications/…
apps/mobile/src/push/ · app/(shell)/notifications.tsx
```

## Complexity Tracking

No violations.
