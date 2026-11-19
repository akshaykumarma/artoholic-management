# Feature Specification: Super Admin Console, Audit Log & Operations

**Feature Branch**: `010-admin-console`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "010-admin-console from docs/PRD-v1.1-source.md §6.7 (ADM-01 to ADM-05): Super Admin console for company profile, integrations, templates and master lists (event types, units of measure, damage reasons); searchable, exportable append-only audit log kept 3 years; Login & activity page with the permanent message log; data import from Excel templates with dry-run; daily database and photo backups kept 30 days with tested restore; system health page extending 001; data retention jobs (damage photos deleted after 6 months, events/ledger/audit kept 3 years with opening-balance roll-up, item photos and damage records kept forever)."

## Overview

This feature gives the Super Admin one place to configure the platform and keep it healthy: the
company profile, master lists, integrations, the audit log and message log, bulk imports,
backups and data retention. Admins can read the audit log; only the Super Admin changes settings.
The console is web-only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search the audit log (Priority: P1)

The Super Admin (and Admins, read-only) search every recorded action — creates, edits, approvals,
sign-ins, failed sign-ins, settings changes — by date range, user, action type and record, see
before/after values, and export the results to Excel.

**Why this priority**: Accountability for stock and approvals is the platform's purpose
(constitution V).

**Independent Test**: Edit an item's replacement value; search the audit log for that item and
confirm one entry showing the old and new value, who and when; export it.

**Acceptance Scenarios**:

1. **Given** 500,000 audit entries, **When** searched by user and date, **Then** results show
   within 3 seconds.
2. **Given** any audit entry, **When** anyone looks for a way to edit or delete it, **Then** there
   is none.
3. **Given** an Admin (not Super Admin), **When** they open the audit log, **Then** they can view
   and export but not change anything.

---

### User Story 2 - Login & activity with the message log (Priority: P1)

The Super Admin opens Login & activity and sees sign-ins and failed sign-ins per user, active
sessions by device (with the option to end one), and the permanent WhatsApp and email message
log with full text and delivery status, one-time codes redacted.

**Acceptance Scenarios**:

1. **Given** a user signed in on two phones, **When** the Super Admin ends one session, **Then**
   that phone returns to sign-in on its next request; the other stays signed in.
2. **Given** a password-reset WhatsApp message, **When** shown in the log, **Then** the code is
   redacted.

---

### User Story 3 - Company profile and master lists (Priority: P2)

The Super Admin sets the company name, logo, GSTIN and address (used on exports and emails) and
manages master lists: event types, units of measure, damage reasons, short-dispatch reasons.

**Acceptance Scenarios**:

1. **Given** a master-list value in use, **When** the Super Admin tries to delete it, **Then** it
   can only be archived.
2. **Given** a new logo, **When** saved, **Then** new report files and emails use it.

---

### User Story 4 - Bulk import from Excel (Priority: P2)

The Super Admin or an Admin downloads a template (users, categories, items, opening stock,
locations), fills it in, uploads it, reviews a dry-run preview with row-level errors, and
confirms.

**Acceptance Scenarios**:

1. **Given** a file with errors, **When** uploaded, **Then** nothing is saved until every error is
   fixed or the erroneous rows are excluded explicitly.
2. **Given** a confirmed import, **When** done, **Then** the audit log has one entry per created
   record referencing the import.

---

### User Story 5 - Backups and restore (Priority: P2)

The platform takes a daily backup of the database and stored photos and files at 02:00 IST,
keeps 30 days of backups off the main server, and shows the last backup's time, size and result.
A documented restore is tested every quarter and the test is recorded.

**Acceptance Scenarios**:

1. **Given** a failed backup, **When** it fails, **Then** the Super Admin is notified in-app and by
   email within 15 minutes.
2. **Given** the quarterly restore test, **When** performed, **Then** the console records its date,
   who did it and the result; if none is recorded for 100 days, the Super Admin is reminded.

---

### User Story 6 - Data retention runs automatically (Priority: P2)

Retention rules run nightly: damage photos are deleted 6 months after the damage report's
decision; events, the stock ledger and the audit log are kept for at least 3 years; item photos,
damage records and the message log are kept forever. Ledger entries older than 3 years may be
purged only after rolling them into an opening-balance entry per item, bin and condition so
balances stay correct.

**Acceptance Scenarios**:

1. **Given** a damage report decided 6 months ago today, **When** the nightly job runs, **Then**
   its photos are deleted and the report shows "Photos removed after 6 months"; its other details
   remain.
2. **Given** a ledger purge, **When** it runs, **Then** every item's balances are identical before
   and after.
3. **Given** the Super Admin, **When** they open Retention, **Then** they see each rule, its last
   run and what it removed (counts only).

---

### User Story 7 - System health (Priority: P3)

The status page from 001 gains: background job queue length, failed messages in the last 24
hours, storage used and remaining, last backup result, and app versions in use (count of active
sessions per app version).

**Acceptance Scenarios**:

1. **Given** 5 failed WhatsApp messages today, **When** the page opens, **Then** it shows 5 with a
   link to the filtered message log.

### Edge Cases

- A Super Admin console page opened on a phone browser shows a "Use a computer for this page"
  notice but still works.
- An audit export larger than 100,000 rows is generated in the background and emailed to the
  requester as a link.
- A restore to an older backup is a manual, documented operation outside the app; the console
  only records it.
- Retention never deletes anything attached to an event that is not yet Closed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (ADM-01): The Super Admin MUST manage company profile, integrations (from 008),
  message templates and master lists, with archive-not-delete for values in use.
- **FR-002** (ADM-02): The audit log MUST be append-only, searchable by date, user, action and
  record, show before/after values, export to Excel, and be kept at least 3 years.
- **FR-003**: Login & activity MUST show sign-ins, failed sign-ins, active sessions (with end
  session) and the permanent message log with codes redacted.
- **FR-004** (ADM-03): Imports for users, categories, items, opening stock and locations MUST use
  downloadable templates with a dry-run preview and row-level errors.
- **FR-005** (ADM-04): Daily backups of the database and stored files MUST run, be kept 30 days
  off the main server, alert on failure, and record quarterly restore tests.
- **FR-006**: Retention rules MUST run nightly as in User Story 6 and log what they removed.
- **FR-007** (ADM-05): The status page MUST show the extra figures in User Story 7.
- **FR-008**: Only the Super Admin MAY change settings; Admins MAY view the audit log and run
  imports.

### Key Entities

- **Company profile**: name, logo, GSTIN, address, contact.
- **Master list value**: list (event type, unit, damage reason, short-dispatch reason), value,
  status.
- **Backup record**: time, size, location, result.
- **Restore test record**: date, by, result, notes.
- **Retention run**: rule, time, items removed (count), result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any action in the last 3 years can be found in the audit log in under 1 minute.
- **SC-002**: 100% of nights have a successful backup or a failure alert within 15 minutes.
- **SC-003**: A quarterly restore test brings a copy of the platform back with recovery point ≤ 24
  hours and recovery time ≤ 4 hours (constitution service levels).
- **SC-004**: Balances are identical before and after every ledger roll-up.

## Assumptions

- Backups go to S3-compatible storage separate from the main server (provider chosen in planning).
- Integration settings screens are built in 008; this feature places them in the console.
