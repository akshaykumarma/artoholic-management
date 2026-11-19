# Research: 008-notifications

## R1. Pipeline
- **Decision**: Modules call `emit(tx, trigger, payload)` inside their transaction (outbox
  row in `notification_outbox`); a pg-boss worker turns outbox rows into `notifications`
  (in-app) and channel jobs. Outbox guarantees no notification for rolled-back work.

## R2. Push
- **Decision**: Expo Push service with `expo-server-sdk` (one API for FCM and APNs); tokens
  registered per device session on sign-in, deleted on sign-out/deactivation; receipts polled to
  drop invalid tokens. Payload: `{ title, body, data: { path } }` where `path` is a shared deep
  link (`/events/{id}`, `/damage-reports/{id}`, …).
- **Alternatives**: Direct FCM/APNs (two integrations; revisit if Expo service limits matter).

## R3. WhatsApp
- **Decision**: Provider adapter interface `sendTemplate(to, template, lang, params,
  document?)`; first implementation Meta Cloud API (Graph `/{phone-number-id}/messages`),
  mock adapter for dev/test. Documents uploaded via the media endpoint for report files.
  Delivery statuses via signed webhook (`X-Hub-Signature-256`) → `message_events`.

## R4. Email
- **Decision**: SMTP via `nodemailer` (provider-agnostic: SES, ZeptoMail, SendGrid SMTP);
  HTML + text templates in code with company branding (010).

## R5. Redaction
- **Decision**: Templates mark secret params (`{{otp}}`); the logged rendered text substitutes
  `••••••` before insert; a guard also masks any standalone 6-digit sequence in messages whose
  trigger is `auth.*`. Raw codes never reach the log table.

## R6. Preferences and quiet hours
- **Decision**: Defaults from the trigger catalogue; per-user overrides per group × channel;
  quiet hours (IST) defer push and WhatsApp jobs via pg-boss `startAfter`; trigger flag
  `bypassQuietHours` for damage alerts to Admins.

## R7. De-duplication
- **Decision**: Key = (trigger, record id, recipient, channel); within 60 s the later emit
  updates the pending notification instead of creating a new one.

## R8. Retries
- **Decision**: 3 retries at 1, 5, 9 minutes (≈ 15 min total); final failure → in-app alert to
  the Super Admin and status `failed` with reason.
