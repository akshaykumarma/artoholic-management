# Feature Specification: Notifications & Message Log

**Feature Branch**: `008-notifications`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "008-notifications from docs/PRD-v1.1-source.md §6.5 (NTF-01 to NTF-22) and §9: in-app notification centre, push to Android and iOS, WhatsApp Business messages from approved templates, email; triggers for event assignment, dispatch, damage reports and decisions, return dispatch, closure, event changes and over-booking warnings, count due/overdue/variances, scheduled reports (Excel file on WhatsApp and email), low stock, password reset codes; per-user channel choices and quiet hours; Super-Admin-managed templates; permanent message log with full text in each event's activity and in Super Admin → Login & activity, one-time codes redacted (owner rule)."

## Overview

Every handover in the platform depends on the next person knowing it is their turn. This feature
delivers notifications through four channels — in-app, push, WhatsApp and email — from one set of
triggers, lets each person choose their channels, and keeps a permanent log of every WhatsApp and
email message sent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The right people are told at each step (Priority: P1)

When a trigger happens (table below), each recipient gets the notification on their chosen
channels, with the record number, a one-line summary and a link that opens the record in the app.

| Trigger | Recipients | Default channels |
| --- | --- | --- |
| Event scheduled or assignment added (005) | Assigned Event and Store Managers | In-app, push, WhatsApp |
| Removed from an event (005) | That user | In-app, push |
| Warehouse dispatch submitted (006) | Event Manager(s) | In-app, push, WhatsApp |
| Short dispatch (006) | Admins | In-app, push |
| Damage or missing reported, any step (006) | Admins | In-app, push, WhatsApp |
| Damage report approved or rejected (006) | Reporter | In-app, push |
| Return dispatched from site (006) | Store Manager(s) | In-app, push, WhatsApp |
| Event ready to close / closed (006) | Admins / all assignees | In-app, email |
| Event details changed, or over-booking warning raised or resolved (005) | Assignees and Admins | In-app, push (warning: also WhatsApp) |
| Dispatch or return reminder (005) | Store / Event Managers | In-app, push, WhatsApp |
| Count due, overdue (007) | Assigned Store Managers; Admins when overdue | In-app, push, WhatsApp |
| Count variances awaiting approval (007) | Admins | In-app, push |
| Write-off awaiting approval, transfer shortfall (003, 004) | Admins | In-app, push |
| Low stock (003) | Admins | In-app, email |
| Scheduled report ready (009) | Report recipients (Admins only, Q13) | WhatsApp (Excel document), email (attachment) |
| Password reset code (002) | That user | WhatsApp, email |

**Why this priority**: The four-step checklist stalls without it.

**Independent Test**: Submit a site receipt with damage; confirm every Admin receives an in-app
notification, a push on their phone and a WhatsApp message within 2 minutes, each opening the
damage report.

**Acceptance Scenarios**:

1. **Given** a trigger, **When** it fires, **Then** each recipient gets exactly one notification
   per channel, even if they hold several qualifying roles.
2. **Given** a push or WhatsApp link, **When** tapped on a phone with the app, **Then** the app
   opens on that record (after sign-in if needed); on web it opens the web page.
3. **Given** the person who caused the trigger is also a recipient, **When** it fires, **Then**
   they get the in-app entry only (no push or WhatsApp to themselves).

---

### User Story 2 - Notification centre in every app (Priority: P1)

Every app has a notification centre with an unread count, newest first, mark as read (one or
all), and links to the record.

**Acceptance Scenarios**:

1. **Given** 3 unread notifications, **When** one is opened, **Then** the count shows 2 on every
   app the user is signed in to within 30 seconds.
2. **Given** notifications older than 90 days, **When** the centre is opened, **Then** they are no
   longer listed (the message log keeps WhatsApp and email permanently).

---

### User Story 3 - People choose channels and quiet hours (Priority: P2)

Each user chooses, per notification group (events, damage, counts, stock, reports), which of push,
WhatsApp and email they want (in-app is always on), and can set quiet hours (for example
22:00–07:00 IST) during which push and WhatsApp wait until the quiet period ends — except damage
alerts to Admins, which are always sent.

**Acceptance Scenarios**:

1. **Given** a user turns WhatsApp off for counts, **When** a count is due, **Then** they get
   in-app and push only.
2. **Given** quiet hours 22:00–07:00 and a dispatch notification at 23:00, **When** it fires,
   **Then** push and WhatsApp are sent at 07:00, in-app immediately.

---

### User Story 4 - Super Admin manages WhatsApp and email setup and templates (Priority: P2)

The Super Admin enters the WhatsApp provider and email settings, maps each trigger to an approved
WhatsApp template (by name and language) and to an email template, and sends a test message.

**Acceptance Scenarios**:

1. **Given** a trigger with no approved WhatsApp template mapped, **When** it fires, **Then** the
   WhatsApp copy is skipped, logged as "no template", and the other channels still go.
2. **Given** the Super Admin sends a test, **When** it is delivered, **Then** its status appears in
   the message log.

---

### User Story 5 - Permanent message log (Priority: P1)

Every WhatsApp and email message is logged with recipient, channel, template, full rendered text,
attachments, time and delivery status (queued, sent, delivered, read where available, failed with
reason). The log entries for an event appear in that event's activity; the full log is in Super
Admin → Login & activity. One-time codes are always shown redacted.

**Why this priority**: Owner rule — the message log is permanent.

**Acceptance Scenarios**:

1. **Given** any WhatsApp message about an event, **When** the event's activity is viewed by an
   Admin, **Then** the full message text is shown with its delivery status.
2. **Given** a password-reset message, **When** shown anywhere, **Then** the code reads `••••••`.
3. **Given** a failed message, **When** the provider reports failure, **Then** it is retried up to
   3 times over 15 minutes, then marked failed and the Super Admin is notified in-app.

### Edge Cases

- A user has no email: email-only notifications fall back to in-app.
- A phone number is not on WhatsApp: provider failure is logged; push and in-app still delivered.
- The same trigger fires twice for the same record within 60 seconds (for example a resubmit):
  the second notification is merged into the first, not duplicated.
- Push tokens are refreshed on each sign-in; a device signed out or a user deactivated stops
  receiving push immediately.
- WhatsApp's 24-hour customer-service window does not apply: all business-initiated messages use
  approved templates (PRD constraint C1).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (NTF-01–NTF-12): The platform MUST send the notifications in the trigger table to the
  listed recipients on their chosen channels.
- **FR-002** (NTF-20): Every app MUST have a notification centre with unread count, mark as read
  and deep links; entries kept 90 days.
- **FR-003**: Push MUST work on Android and iOS and open the linked record.
- **FR-004**: WhatsApp messages MUST use Super-Admin-mapped approved templates; scheduled reports
  MUST be sent as Excel document messages.
- **FR-005**: Email MUST be sent from Artoholic's domain, with report attachments.
- **FR-006** (NTF-21): Every WhatsApp and email message MUST be logged permanently with full text
  and delivery status, shown in the related record's activity and in Super Admin → Login &
  activity, with one-time codes always redacted.
- **FR-007** (NTF-22): Users MUST be able to set channels per group and quiet hours; Admin damage
  alerts ignore quiet hours.
- **FR-008**: Failed WhatsApp and email deliveries MUST retry up to 3 times over 15 minutes, then
  alert the Super Admin.
- **FR-009**: The Super Admin MUST be able to configure providers and templates and send test
  messages; secrets are stored encrypted and never shown again after saving.
- **FR-010**: Notifications MUST meet the latency levels: in-app and push ≤ 30 s, WhatsApp and
  email ≤ 2 min (constitution service levels).

### Key Entities

- **Notification**: recipient, trigger, record link, summary, created, read time, channels sent.
- **Message (log)**: channel (WhatsApp, email), recipient address, template, rendered text
  (codes redacted), attachments, related record, status history, provider ids — permanent.
- **Channel preference**: user × group × channel on/off; quiet hours.
- **Device push registration**: user, device session, platform, token, updated.
- **Template mapping**: trigger × channel → template name, language, variables.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 99% of push notifications arrive within 30 seconds and 99% of WhatsApp messages are
  accepted by the provider within 2 minutes.
- **SC-002**: 100% of WhatsApp and email messages appear in the message log with final status.
- **SC-003**: Zero one-time codes appear unredacted in any log, screen or export.
- **SC-004**: Zero duplicate notifications for one trigger per recipient per channel.

## Assumptions

- Provider choice (Meta Cloud API directly or a business solution provider) is a planning
  decision; a development mock provider exists for testing, as in Service Management.
- Templates are approved by Meta outside the platform; the platform only maps them.
- "Login & activity" is the Super Admin console page delivered in 010; until then the log is
  visible on each record's activity.
