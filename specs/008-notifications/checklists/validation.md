# Validation record: 008 Notifications

**Date**: 2026-11-19 · **Branch**: `008-implementation`

## Scenarios

| Story | Scenario | Result | Evidence |
|-------|----------|--------|----------|
| US1-1 | One notification per recipient per channel, even with several qualifying roles | Pass | `tests/integration/notifications.test.ts` |
| US1-2 | Push and WhatsApp links open the record (app maps web paths to its screens) | Pass | `packages/shared/tests/deeplinks.test.ts`; mobile `push-deeplink.test.tsx` |
| US1-3 | The person who caused a trigger gets in-app only | Pass | `notifications.test.ts` |
| US2 | Centre: unread count, newest first, read one or all, 90-day window; unread badge in the web menu, refreshed every 30 s | Pass | `notifications.test.ts`; e2e `notifications.spec.ts` |
| US3-1 | WhatsApp off for counts → in-app and push only | Pass | `notifications.test.ts`; e2e |
| US3-2 | Quiet hours 22:00–07:00 hold push and WhatsApp until 07:00 IST; damage alerts to Admins still go | Pass | `notifications.test.ts` |
| US4-1 | Trigger with no approved WhatsApp template → WhatsApp skipped and logged "no template"; other channels go | Pass | `notifications.test.ts` |
| US4-2 | Test message appears in the log with its status | Pass | `notifications.test.ts`; e2e |
| US5-1 | WhatsApp/email full text shown in the event's activity | Pass | `server/events/activity.ts` includes `messages` |
| US5-2 | Password-reset code reads `••••••` in the log; the phone gets the real code | Pass | `notifications.test.ts` |
| US5-3 | Failed delivery retried at 1, 5 and 9 min, then failed and the Super Admin told | Pass | `notifications.test.ts` |
| Edge | A repeat within 60 s merges; a signed-out device gets no push; messages can't be deleted or rewritten | Pass | `notifications.test.ts` |
| FR-009 | Provider secrets AES-256-GCM encrypted, write-only, Super Admin only | Pass | `notifications.test.ts` |
| R3 | Webhook statuses accepted only with a valid `X-Hub-Signature-256` | Pass | `notifications.test.ts` |

## Checks

- Shared 67/67, web integration and contract 260/260, mobile 31/31, Playwright e2e 13/13.
- Typecheck and lint clean (exit code 0).

## Before going live (owner actions)

- Set `SETTINGS_ENCRYPTION_KEY` and `APP_URL` in production, and `EAS_PROJECT_ID` for mobile builds (push tokens).
- WhatsApp: create the Meta Cloud API app in Artoholic's name (Q11), get templates approved, then enter the phone number ID,
  token and app secret in Admin → WhatsApp and email, and map each trigger to its template. Until then WhatsApp copies
  are logged as "no template". Webhook URL: `/api/webhooks/whatsapp`.
- Email: enter the SMTP host and from-address there (Mailpit catches mail locally).

## Implementation notes

- Push uses Expo's push HTTP API directly (no `expo-server-sdk`); tokens are deleted when Expo reports `DeviceNotRegistered`.
  Receipt polling is not added yet.
- Delivery runs every 5 s in the web process (in-app and push ≤ 30 s); the 90-day purge runs nightly.
- Reports as Excel documents over WhatsApp (FR-004) arrive with 009.
