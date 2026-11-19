# Feature Specification: Users, Roles & Sign-in

**Feature Branch**: `002-auth-rbac`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "002-auth-rbac from docs/PRD-v1.1-source.md §6.1 (USR-01 to USR-11) and §4 (roles, permission matrix 4.3): user creation with mandatory phone, optional email, username defaulting to email (or phone), password, multiple roles per user; Store Managers assigned to one or more warehouses; exactly one Super Admin; sign-in with username, email or phone; password reset by one-time code over WhatsApp and email; temporary passwords; deactivation instead of deletion; mobile 30-day sessions with biometric unlock; last-Admin protection."

## Overview

Feature 001 delivered the app shell with only the installation Super Admin. This feature lets
Admins create and manage every other staff account, assign roles (one person may hold several),
and gives every user a complete sign-in experience on web, Android and iOS: sign-in by
username, email or phone; first-login password change; forgotten-password reset; deactivation;
and biometric unlock on phones. It also fixes the permission matrix that every later feature
enforces.

## Clarifications

### Session 2026-11-19

- Q: Can two staff accounts share the same phone number? → A: No — every account needs its own phone number; people sign in with their own account on shared devices.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates a staff account with one or more roles (Priority: P1)

An Admin opens Users, creates a new person with full name, phone number, optional email,
username, a temporary password and one or more roles, and (for a Store Manager) the warehouses
they look after. The new person can sign in straight away.

**Why this priority**: Without accounts for Event and Store Managers, no event or warehouse work
can be done in the platform.

**Independent Test**: As an Admin, create a user with the Event Manager and Store Manager roles;
sign in as that user on a phone and confirm the menu combines both roles.

**Acceptance Scenarios**:

1. **Given** an Admin on the new-user form, **When** they save without a phone number, **Then**
   the form is rejected with "Phone number is required" and nothing is saved.
2. **Given** an email `ravi@example.com` and no username typed, **When** the Admin saves,
   **Then** the username is `ravi@example.com`.
3. **Given** no email and no username typed, **When** the Admin saves, **Then** the username is
   the phone number in international form (for example `+919876543210`).
4. **Given** a phone number, email or username already used by another account (active or
   deactivated), **When** the Admin saves, **Then** the form is rejected naming the field that
   clashes.
5. **Given** a user created with roles Event Manager and Store Manager, **When** they sign in,
   **Then** their permissions are the union of both roles.
6. **Given** an Admin, **When** they try to give anyone the Admin or Super Admin role, **Then**
   Super Admin is never offered and Admin is offered only to the Super Admin.

---

### User Story 2 - Staff sign in with username, email or phone (Priority: P1)

A staff member signs in on any app with whichever identifier they remember — username, email or
phone — plus their password. A person given a temporary password must choose a new one before
doing anything else.

**Why this priority**: Every user needs to get in; most site staff remember their phone number
rather than a username.

**Independent Test**: Create a user with a temporary password; sign in with the phone number,
confirm the forced password change, then sign out and sign in with the email.

**Acceptance Scenarios**:

1. **Given** an active user, **When** they sign in with their username, their email, or their
   phone number (with or without +91 and spaces) and the right password, **Then** they are
   signed in.
2. **Given** a user signing in for the first time with a temporary password, **When** sign-in
   succeeds, **Then** they must set a new password (meeting the password rules) before any other
   screen opens.
3. **Given** a deactivated user, **When** they try to sign in, **Then** they see the same generic
   "Username or password is incorrect" message.

---

### User Story 3 - Forgotten password reset by one-time code (Priority: P1)

A user who forgot their password asks for a reset, receives a 6-digit code by WhatsApp (and by
email if they have one), enters it, and sets a new password.

**Why this priority**: Site staff cannot wait for an Admin on event day; self-service reset
avoids lock-outs.

**Independent Test**: Request a reset for a user with phone and email; confirm both messages
arrive with the same code, enter it, set a new password, and sign in with it.

**Acceptance Scenarios**:

1. **Given** a user enters their username, email or phone on "Forgot password", **When** they
   submit, **Then** the screen always says "If an account matches, we've sent a code", whether
   or not an account exists.
2. **Given** a code was sent, **When** the user enters it within 10 minutes, **Then** they can
   set a new password, and all their other sessions on every device end.
3. **Given** 5 wrong codes, or a code older than 10 minutes, **When** the user tries again,
   **Then** the code is refused and they must request a new one.
4. **Given** a reset message, **When** it is viewed in any message log, **Then** the code is
   shown redacted (for example `••••••`).

---

### User Story 4 - Admin deactivates and reactivates users (Priority: P2)

When someone leaves, an Admin deactivates their account. Their history stays, every open session
on every device ends at once, and they can no longer sign in. An Admin can reactivate them later.

**Why this priority**: Protects stock and approvals once staff leave; needed before go-live but
after the core sign-in flows.

**Independent Test**: Sign a user in on a phone, deactivate them on the web, and confirm the
phone's next action returns to sign-in and sign-in is refused.

**Acceptance Scenarios**:

1. **Given** a user signed in on a phone, **When** an Admin deactivates them, **Then** the
   phone's next request is refused and the app returns to sign-in.
2. **Given** a deactivated user, **When** anyone views past events, approvals or the audit log,
   **Then** that user's name still appears on their past actions.
3. **Given** an Admin, **When** they try to deactivate their own account, or remove the Admin
   role from the last active Admin, **Then** the change is refused with an explanation.
4. **Given** a Store Manager assigned to warehouses, **When** they are deactivated, **Then** the
   warehouses keep the assignment history and show "no active Store Manager" if none remains.

---

### User Story 5 - Phone users unlock with fingerprint or face (Priority: P3)

On Android and iOS, a signed-in user can turn on biometric unlock so that reopening the app asks
for fingerprint or face instead of a password, for the life of their 30-day session.

**Why this priority**: Convenience on site; the platform is usable without it.

**Independent Test**: Turn on biometric unlock, close and reopen the app, and confirm a
biometric prompt appears; cancel it and confirm the password option is offered.

**Acceptance Scenarios**:

1. **Given** biometric unlock is on, **When** the app is reopened after more than 5 minutes in the
   background, **Then** it asks for fingerprint or face before showing any data.
2. **Given** the biometric check fails or is cancelled 3 times, **When** the user continues,
   **Then** they must sign in with their password.
3. **Given** the device has no biometrics enrolled, **When** the user opens settings, **Then** the
   option is hidden.

---

### User Story 6 - Admin edits a user's details and roles (Priority: P2)

An Admin changes a user's name, phone, email, username, roles or warehouse assignments, or sets a
new temporary password. Changes take effect at the user's next request.

**Independent Test**: Remove the Store Manager role from a signed-in user and confirm their next
screen load drops the warehouse menu and the platform refuses warehouse actions.

**Acceptance Scenarios**:

1. **Given** a signed-in user whose role is removed, **When** they next act, **Then** actions of
   that role are refused and the menu no longer shows its modules.
2. **Given** an Admin sets a new temporary password, **When** saved, **Then** all the user's
   sessions end and they must change it at next sign-in.
3. **Given** any change to a user, **When** saved, **Then** an audit entry records who changed
   what, with old and new values (never passwords).

### Edge Cases

- Phone numbers typed in different forms (`98765 43210`, `+91-98765-43210`, `09876543210`) are
  normalised to `+919876543210` before uniqueness checks and sign-in; numbers without a country
  code default to +91.
- An email typed in mixed case matches regardless of case.
- A username that looks like someone else's phone number or email is refused, so sign-in by any
  identifier always finds at most one account.
- A reset is requested for a user with no WhatsApp on that number: the email copy still works;
  with neither delivered, the Admin can set a temporary password.
- Reset codes are requested repeatedly: at most 3 codes per account per hour; further requests
  show the same generic message but send nothing.
- Several helpers use one shared warehouse phone: each still has their own account and own phone
  number; they sign in and out on the shared device with their own credentials.
- A Store Manager has no warehouses assigned: they can sign in but warehouse screens say "No
  warehouses assigned — contact your Admin".
- The Super Admin forgets their password: reset works the same way; if no message channel works,
  the installer's command-line reset (from 001) is the fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (USR-01): Admins and the Super Admin MUST be able to create users with full name,
  phone number (mandatory, unique per account — no sharing, stored with country code, default +91), email (optional,
  unique when given), username, temporary password, and one or more roles.
- **FR-002** (USR-02): The username MUST default to the email, else to the phone number; the
  creator MAY override it; it MUST be unique across usernames, emails and phone numbers of all
  accounts.
- **FR-003** (USR-03): Permissions MUST be the union of the user's roles, following the matrix
  below; every API action MUST be checked on the server.
- **FR-004** (USR-04): Store Managers MUST be assignable to one or more warehouses; a warehouse
  MAY have several Store Managers (owner decision Q1). Warehouse-scoped permissions apply only
  to assigned warehouses. (Warehouses themselves are created in 004; until then the assignment
  list is empty.)
- **FR-005** (USR-05): Exactly one Super Admin MUST exist; only the Super Admin MAY grant,
  remove or edit the Admin role or edit Admin accounts.
- **FR-006** (USR-06): Users MUST be able to sign in with username, email or phone plus
  password on all three apps.
- **FR-007** (USR-07): Forgotten-password reset MUST send a 6-digit code by WhatsApp and, if
  present, email; codes expire after 10 minutes, allow 5 attempts, are limited to 3 per account
  per hour, and are always redacted in message logs and the audit log.
- **FR-008** (USR-08): A temporary password (set at creation or by an Admin) MUST be changed at
  next sign-in before any other action.
- **FR-009**: Passwords MUST be at least 8 characters, MUST NOT equal the username, phone or
  email, and MUST NOT be in a list of the 10,000 most common passwords.
- **FR-010** (USR-09): Users MUST be deactivated, never deleted; deactivation MUST end all their
  sessions immediately and keep their name on past records. Reactivation MUST require a new
  temporary password.
- **FR-011** (USR-10): Mobile sessions MUST last up to 30 days and MAY be unlocked by device
  biometrics when the app returns after more than 5 minutes in the background.
- **FR-012** (USR-11): The platform MUST refuse any change that would leave no active Admin, and
  MUST refuse a user deactivating themselves.
- **FR-013**: A password change or reset MUST end the user's other sessions on all devices.
- **FR-014**: Every user creation, edit, role change, warehouse assignment change, deactivation,
  reactivation, password reset request and completion MUST produce an audit entry.
- **FR-015**: The Users list MUST support search by name, username, phone and email, and filters
  by role, status and warehouse.

### Permission matrix (binding for 003–011)

Key: **F** full · **A** assigned records only · **V** view only · **–** none.

| Capability | Super Admin | Admin | Event Manager | Store Manager |
| --- | --- | --- | --- | --- |
| Create and edit Admins | F | – | – | – |
| Create and edit other users and roles | F | F | – | – |
| Platform settings, integrations, templates | F | V | – | – |
| Categories, items, units of measure | F | F | V | V (stock actions only) |
| Warehouses and location setup | F | F | – | A |
| View stock levels | F | F | V | A |
| Create, edit and cancel events | F | F | – | – |
| View events | F | F | A | A |
| Warehouse dispatch and receipt steps | F | F | – | A |
| Site receipt and return dispatch steps | F | F | A | – |
| Report damage or loss with photo | F | F | A | A |
| Approve damage, loss and stock adjustments | F | F (any Admin, Q3) | – | – |
| Physical-count schedules | F | F | – | – |
| Perform a physical count | F | F | – | A |
| Edit a closed event | F | F | – | – |
| Run reports | F | F | A | A |
| Report schedules and recipients | F | F | – | – |
| Audit log | F | V | – | – |

### Key Entities

- **User**: name, phone (normalised, unique), email (optional, unique), username (unique across
  all identifiers), password (irreversible hash), temporary-password flag, status, timestamps.
- **Role assignment**: user × role; many per user.
- **Warehouse assignment**: Store Manager × warehouse, with assigned/unassigned dates.
- **Password reset request**: user, code (stored hashed), channel(s), sent time, attempts,
  used/expired state.
- **Session** (from 001): extended with biometric-unlock enabled flag per device session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Admin can create a new staff account with two roles in under 2 minutes.
- **SC-002**: A user who forgot their password can be signed in again, without Admin help, in
  under 3 minutes when WhatsApp is reachable.
- **SC-003**: 100% of a deactivated user's sessions are refused within 5 seconds of deactivation,
  on every device.
- **SC-004**: 100% of actions outside a user's roles or warehouse assignments are refused, as
  verified by a test per cell of the permission matrix.
- **SC-005**: No reset screen or sign-in error reveals whether an account exists (verified by
  identical responses for existing and non-existing identifiers).
- **SC-006**: Reopening the phone app with biometric unlock takes under 3 seconds to reach the
  last screen.

## Assumptions

- WhatsApp and email sending use the notification channels built in 008; until 008 ships, this
  feature sends reset messages through the same provider interfaces with a development mock.
- Admins are trusted to hand temporary passwords to staff in person or by phone; the platform
  does not send passwords in messages.
- Biometric unlock only unlocks an existing session on the device; it never replaces the password
  for a new sign-in.
- Apple's account-deletion rule is handled by a "Request account deletion" action that notifies
  Admins (detailed in 011); accounts are deactivated and pseudonymised, not erased, to keep the
  audit trail (constitution V).
