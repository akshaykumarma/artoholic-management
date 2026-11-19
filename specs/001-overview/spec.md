# Feature Specification: Platform Overview, Conventions & App Shell

**Feature Branch**: `001-overview`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "001-overview for the Artoholic Event Operations Platform. Source: docs/PRD-v1.1-source.md §14.2 row 001: product overview, glossary, shared conventions (IDs, dates DD-MM-YYYY, ₹ with Indian grouping, IST display / UTC storage), and repository layout (web, mobile, API, shared types). It is the foundation every later feature (002–011) builds on: one versioned API serving a Next.js web app and a React Native (Expo) Android/iOS app, the module map (users & roles, inventory incl. cut products, warehouses & locations, events & four-step checklist, physical counts, notifications, reports, admin console), the role model (Super Admin, Admin, Event Manager, Store Manager, multi-role users), and the app shell: sign-in placeholder, navigation by role, health check, forced-update check for mobile."

## Overview

Artoholic is an event management company (weddings, private and corporate functions, political
rallies). This platform tracks every physical item Artoholic owns from the warehouse shelf to the
event site and back, and records who is accountable at each step. It is used through three
apps — a web app, an Android app, and an iOS app — that all show the same data.

This feature delivers the foundation every later feature builds on: the shared vocabulary, the
module map, the role model, the display and identifier conventions, and an app shell in which a
person can sign in, see the menu for their roles, and be told when their mobile app is too old.
It delivers no business module itself; modules arrive in features 002–011 (see Module Map).

## Clarifications

### Session 2026-11-19

- Q: Should Admins be able to change an item's code after the item is created? → A: Yes — item codes are editable at any time; every change is audited and the old code still finds the item in search.
- Q: How long can a signed-in person stay inactive before being signed out? → A: Web signs out after 60 minutes without activity; mobile stays signed in for up to 30 days unless the person signs out or is deactivated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and land on a role-aware home screen (Priority: P1)

A staff member opens the web app, the Android app, or the iOS app, signs in, and lands on a home
screen whose menu shows only the modules their roles allow. A person with more than one role
(for example Event Manager and Store Manager) sees the combined menu of all their roles, once
each. Until feature 002 delivers full user management, the only account is the Super Admin
created at installation.

**Why this priority**: Every later feature plugs a module into this shell. Without a working
sign-in and role-aware navigation on all three apps, nothing else can be delivered or tested.

**Independent Test**: Install the platform, sign in as the installation Super Admin on the web
app and on an Android and an iOS device, and confirm each lands on the home screen with the
Super Admin menu; sign out and confirm the home screen is no longer reachable.

**Acceptance Scenarios**:

1. **Given** a freshly installed platform, **When** the installation Super Admin signs in on the
   web app, **Then** they land on the home screen showing the Super Admin menu.
2. **Given** the same Super Admin, **When** they sign in on the Android app and the iOS app,
   **Then** each app shows the same menu entries as the web app (except web-only entries such as
   the Super Admin console, which mobile apps do not show).
3. **Given** a user who holds the Event Manager and Store Manager roles, **When** they sign in,
   **Then** the menu shows each module allowed by either role exactly once.
4. **Given** a signed-in user, **When** they open a screen their roles do not allow (for example
   by a saved link), **Then** they see a "You don't have access to this page" message, not the
   page's content.
5. **Given** a signed-out visitor, **When** they open any screen other than sign-in, **Then**
   they are sent to sign-in and, after signing in, returned to the screen they asked for if
   their roles allow it.
6. **Given** a wrong username or password, **When** the visitor submits sign-in, **Then** they
   see one generic "Username or password is incorrect" message that does not reveal which part
   was wrong.

---

### User Story 2 - Consistent dates, money, times, and identifiers everywhere (Priority: P1)

Wherever a date, time, amount of money, quantity, or record number appears — on any screen of
any app, in exports, and in messages — it is shown the same way, so staff in the office and at a
venue read the same values and can quote a record number to each other unambiguously.

**Why this priority**: Every later module displays these values. Fixing the conventions once,
before modules exist, prevents three apps drifting into three formats and prevents mismatched
times between office and venue.

**Independent Test**: Render the reference sample screen (a fixed set of sample values shown by
the shell) on web, Android, and iOS, and compare every value against the convention table in
FR-010–FR-016.

**Acceptance Scenarios**:

1. **Given** a stored moment of 2026-11-19 18:30 UTC, **When** it is shown on any app, **Then** it
   reads "20-11-2026 00:00 IST" on every app, regardless of the device's own time zone.
2. **Given** an amount of 1234567.5 rupees, **When** it is shown, **Then** it reads "₹12,34,567.50".
3. **Given** the first event created in 2026, **When** its number is shown, **Then** it reads
   `EVT-2026-0001`, and the first event of 2027 reads `EVT-2027-0001`.
4. **Given** a quantity of 12.5 metres, **When** it is shown, **Then** it reads "12.5 m"; a
   counted quantity of 40 pieces reads "40" with no unit.

---

### User Story 3 - Out-of-date mobile apps are told to update (Priority: P2)

When the Android or iOS app on a staff phone is older than the oldest version the platform still
supports, the app shows a blocking "Update required" screen with a button to the app store
instead of letting the person start work that would then fail. When a newer version is merely
recommended, the app shows a dismissible prompt.

**Why this priority**: Staff phones update on their own schedule. Without this check, a manager
at a venue could fill in half a checklist on an app the platform no longer understands. It is
P2 because it only matters once a second mobile release exists.

**Independent Test**: Set the minimum supported mobile version above the installed version and
open the app; confirm the blocking screen. Set only the recommended version above it and confirm
the dismissible prompt.

**Acceptance Scenarios**:

1. **Given** the installed app version is below the minimum supported version, **When** the app
   is opened or brought back to the foreground, **Then** it shows the blocking "Update required"
   screen with a button that opens the correct app store page, and no other screen is reachable.
2. **Given** the installed version is at or above the minimum but below the recommended version,
   **When** the app opens, **Then** it shows a prompt the person can dismiss; it reappears at most
   once per day.
3. **Given** the platform cannot be reached when the app opens, **When** the version check
   fails, **Then** the app does not block the person and retries the check on the next launch or
   when the connection returns.
4. **Given** a Super Admin, **When** they change the minimum or recommended version for Android
   or iOS, **Then** the change applies to the next version check on every device, without a new
   app release.

---

### User Story 4 - Super Admin can see that the platform is healthy (Priority: P3)

The Super Admin opens a status page that shows whether the platform and its essential parts
(stored data, file storage, background work) are working, along with the platform version and the
minimum and recommended mobile versions. An outside uptime monitor can also check the platform
without signing in.

**Why this priority**: It supports the 99.5% availability target and quick fault-finding, but
staff can work without it, so it follows the shell and conventions.

**Independent Test**: Open the status page as Super Admin with all parts working and confirm all
show "OK"; stop file storage and confirm it shows "Down" within one minute while the rest stay
"OK".

**Acceptance Scenarios**:

1. **Given** all parts are working, **When** the Super Admin opens the status page, **Then** each
   part shows "OK" with the time it was last checked, plus the platform version.
2. **Given** one part has failed, **When** the status page is opened, **Then** that part shows
   "Down" and the overall status shows "Degraded".
3. **Given** an outside uptime monitor with no sign-in, **When** it checks the platform's public
   health address, **Then** it receives only an overall up/down answer, with no version numbers,
   part names, or other internal detail.
4. **Given** a user without the Super Admin role, **When** they try to open the status page,
   **Then** they are refused.

---

### Edge Cases

- A user with no roles at all signs in (possible once 002 exists): they see a home screen with
  the message "No modules are assigned to you yet — contact your Admin" and no module entries.
- A user's roles change while they are signed in: the new menu applies no later than their next
  screen load, and any action their roles no longer allow is refused by the platform even if the
  old menu is still on screen.
- A device clock or time zone is wrong: displayed times still follow IST from the stored moment;
  times recorded by the platform use the platform's clock, not the device's.
- A record number sequence crosses a year boundary at 00:00 IST on 1 January: the number takes
  the year in IST, not UTC, so an event created at 00:30 IST on 1 January 2027 gets `EVT-2027-…`.
- Two records of the same kind are created at the same instant: each still gets a unique,
  consecutive number with no gaps caused by the clash, and no number is ever reused.
- An Admin changes item code `ITM-00001` to `CHR-WHITE-01`: searching for either code finds the
  item; a different item can never later take `ITM-00001`; reports show the current code.
- A negative amount (a correction) is shown as "−₹1,200.00"; zero as "₹0.00".
- A web user is inactive for 60 minutes with a half-filled form: the next action asks them to
  sign in again, then returns them to the form with their entries kept.
- A mobile user's 30-day session expires mid-event: they sign in again and their unsubmitted
  checklist entries are still there.
- Repeated failed sign-ins: after 5 failed attempts for one account within 15 minutes, further
  attempts for that account are refused for 15 minutes, with a message saying when to try again.
- A module entry exists in the module map but its feature has not shipped yet: it does not
  appear in any menu.

## Requirements *(mandatory)*

### Functional Requirements

**Apps and shared data**

- **FR-001**: The platform MUST be usable through three apps — a web app (desktop and mobile
  browsers), an Android app, and an iOS app — that read and write the same data through one shared,
  versioned interface. No app may keep business data that the others cannot see.
- **FR-002**: Each app MUST identify its own type (web, Android, iOS) and version to the platform
  on every request, so the platform can enforce the minimum supported version (FR-030) and record
  the device type in audit entries.
- **FR-003**: The web app MUST work on screens from 360 px wide upward; the mobile apps MUST work
  in portrait orientation on phones.

**Sign-in and session (placeholder until 002)**

- **FR-004**: The platform MUST create exactly one Super Admin account at installation, from
  details supplied by the installer, and MUST NOT offer any screen that creates another Super Admin.
- **FR-005**: Users MUST be able to sign in with username and password on all three apps, and to
  sign out. Full user management, other sign-in identifiers, password reset, and biometric unlock
  are delivered by feature 002.
- **FR-005a**: A web session MUST end after 60 minutes without activity, after which the next
  action sends the person to sign-in and back to where they were. A mobile session MUST stay
  signed in for up to 30 days from sign-in, unless the person signs out or their account is
  deactivated. Entered but unsubmitted work MUST NOT be lost when a session ends; it is kept on
  the device and offered again after signing back in.
- **FR-006**: Sign-in MUST refuse further attempts for an account for 15 minutes after 5 failed
  attempts within 15 minutes, and MUST show the same generic message for a wrong username and a
  wrong password.
- **FR-007**: Every sign-in, failed sign-in, and sign-out MUST produce an audit entry with the
  account (if known), time, app type and version, and network address.

**Roles and navigation**

- **FR-008**: The platform MUST support exactly four roles — Super Admin, Admin, Event Manager,
  Store Manager — and a user MAY hold any combination of them; a user's permissions are the union
  of their roles' permissions.
- **FR-009**: The menu on every app MUST be built from the module map: an entry appears only if
  its module has shipped and at least one of the user's roles allows it, and appears once even if
  several roles allow it. The platform MUST refuse any action the user's roles do not allow,
  independently of what the menu shows.

**Display and identifier conventions** (apply to every screen, export, and message)

- **FR-010**: The platform MUST store every moment in time in UTC and MUST display it in Indian
  Standard Time (Asia/Kolkata), independently of the device's time zone, with "IST" shown wherever
  a time of day appears.
- **FR-011**: Dates MUST be displayed as DD-MM-YYYY; date with time as DD-MM-YYYY HH:mm (24-hour)
  followed by "IST". Calendar dates that have no time of day (for example an event's
  leave-warehouse date) MUST be stored and shown as plain dates, never shifted by time zone.
- **FR-012**: Money MUST be held in rupees with paise (two decimal places), without rounding error,
  and displayed with the ₹ symbol and Indian digit grouping (₹1,00,000.00); negative amounts with a
  leading minus sign.
- **FR-013**: Quantities MUST be shown with their unit of measure abbreviation when the item has
  one ("12.5 m", "3 kg") and as a plain number when it is counted in pieces; decimal quantities
  MUST show up to 3 decimal places without trailing zeros.
- **FR-014**: Records that people quote to each other MUST get a human-readable number that is
  unique and never reused, and (except item codes) never changed after creation, in these formats (the year is the IST
  calendar year of creation; numbering restarts at 0001 each year):

  | Record | Format | Example | Delivered in |
  | --- | --- | --- | --- |
  | Event | `EVT-YYYY-NNNN` | `EVT-2026-0001` | 005 |
  | Damage or loss report | `DMG-YYYY-NNNNN` | `DMG-2026-00001` | 006 |
  | Physical count session | `CNT-YYYY-NNNN` | `CNT-2026-0001` | 007 |
  | Stock transfer | `TRF-YYYY-NNNN` | `TRF-2026-0001` | 004 |
  | Item | `ITM-NNNNN` by default (not by year); Admins may change it at any time | `ITM-00001` | 003 |

  Warehouse codes are chosen by Admins; location codes are built from the warehouse code and
  location levels (for example `MAIN-A-03-02`), as specified in feature 004. Sequences longer
  than their padding continue with more digits (`EVT-2026-10000`) rather than failing.
  An item code change MUST keep the new code unique among all current and former item codes,
  MUST be recorded in the audit log with the old and new code, and the item MUST remain findable
  by every code it has ever had.
- **FR-015**: Phone numbers MUST be stored with country code and displayed as "+91 98765 43210"
  for Indian numbers.
- **FR-016**: All user-facing text MUST be in English and MUST be kept separate from app logic so
  that adding another language later requires no change to app behaviour.

**Mobile version control**

- **FR-030**: The Super Admin MUST be able to set, separately for Android and iOS, a minimum
  supported version and a recommended version, and the store link for each.
- **FR-031**: The mobile apps MUST check their version against these settings when opened and when
  brought back to the foreground, and MUST behave as described in User Story 3. The platform MUST
  also refuse requests from app versions below the minimum with a response the app turns into the
  "Update required" screen.

**Platform health**

- **FR-040**: The platform MUST provide a Super-Admin-only status page showing, for stored data,
  file storage, and background work, a status of OK or Down with the time of the last check,
  plus the overall status (OK, Degraded, Down), the platform version, and the mobile version
  settings.
- **FR-041**: The platform MUST provide a public health address that answers only "up" or "down"
  and reveals no internal detail.

**Shared reference content**

- **FR-050**: The glossary and module map in this specification are the reference vocabulary for
  every later feature; later specifications MUST use these terms and MUST NOT redefine them
  without amending this specification.

### Glossary

| Term | Meaning |
| --- | --- |
| Item | A kind of physical thing Artoholic owns and lends to events (chairs, lights, carpet). |
| Tracking type | How an item is counted: **counted** (pieces), **measured** (an amount in a unit such as m or kg), or **cut product** (each roll or piece tracked with its current length). |
| Cut product | An item such as carpet or fabric that is cut to length; offcuts go back into stock. |
| Piece | One individual roll or length of a cut product. |
| Unit of measure (UoM) | The unit a measured or cut item is counted in (m, cm, kg, L). Counted items have none. |
| Stock condition | The state a quantity is in: Available, Reserved, Out, Damaged, Lost, Written off. |
| Warehouse | A building where stock is kept. Has its own location levels. |
| Location / bin | A user-defined place inside a warehouse (for example Aisle → Row → Box); the lowest level is the bin that holds stock. |
| Ledger / movement | The append-only record of every change in stock; quantities on screen are derived from it. |
| Event | A function Artoholic serves (wedding, rally, ...) with dates, a venue, managers, and required items. |
| Event line | One required item on an event, with planned, dispatched, received, returned, damaged, lost, and consumed quantities. |
| Checklist step | One of the four handovers: warehouse dispatch, site receipt, return dispatch, warehouse receipt. |
| Dispatch round | One pass through the checklist steps; an event may have extra rounds when items are added. |
| Reconciled | An event line where returned + handed over + damaged + lost + consumed = dispatched. |
| Handover | Items passed directly from one event to another without returning to a warehouse, counted by both Event Managers. |
| Damage report | A record of damaged or missing quantity with photos, awaiting or carrying an Admin decision. |
| Over-booking | Required quantity for an event's date window exceeds available stock; allowed, with a warning. |
| Physical count | A scheduled or ad-hoc count of stock against the records, producing variances for approval. |
| Variance | Counted quantity minus recorded quantity on a count line. |
| Leave-warehouse date | The date items are due to leave the warehouse for an event. |
| Expected return date | The date items are due back in the warehouse. |
| Module | A functional area that appears in the menu (see Module Map). |

### Module Map

| Module | Menu for roles | Apps | Delivered in |
| --- | --- | --- | --- |
| Home | All | Web, Android, iOS | 001 |
| Users & roles | Super Admin, Admin | Web, Android, iOS | 002 |
| Inventory (categories, items, units, cut products, item view) | Super Admin, Admin, Store Manager; Event Manager view only | Web, Android, iOS | 003 |
| Warehouses & locations | Super Admin, Admin, Store Manager (assigned) | Web, Android, iOS | 004 |
| Events (planning, calendar) | Super Admin, Admin; Event and Store Managers (assigned) | Web, Android, iOS | 005 |
| Event checklists & damage approval | Super Admin, Admin; Event and Store Managers (assigned) | Web, Android, iOS | 006 |
| Physical counts | Super Admin, Admin, Store Manager (assigned) | Web, Android, iOS | 007 |
| Notifications | All | Web, Android, iOS | 008 |
| Reports & dashboard | Super Admin, Admin; managers limited to their records | Web, Android, iOS (view and share) | 009 |
| Super Admin console & audit log | Super Admin (Admin views audit log) | Web only | 010 (status page and mobile version settings: 001) |
| Mobile store release | — (release work, no menu entry) | Android, iOS | 011 |

### Key Entities *(include if feature involves data)*

- **User account**: a person who can sign in; holds a username, password (stored only in a form
  that cannot be reversed), status, and one or more roles. Only the installation Super Admin exists
  in this feature; 002 adds the rest.
- **Role**: one of Super Admin, Admin, Event Manager, Store Manager; many-to-many with users.
- **Module**: an entry of the module map, with the roles that may see it, the apps it appears on,
  and whether it has shipped.
- **Number sequence**: per record kind and IST year, the last number issued; guarantees unique,
  never-reused record numbers.
- **Mobile version setting**: per platform (Android, iOS), the minimum supported version, the
  recommended version, and the store link.
- **Audit entry**: who did what, when, from which app type and version and network address; this
  feature writes sign-in, failed sign-in, sign-out, and version-setting changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The installation Super Admin can sign in and reach the home screen on the web app,
  an Android phone, and an iPhone in under 30 seconds each from opening the app.
- **SC-002**: 100% of the reference sample values (dates, times, money, quantities, record
  numbers, phone numbers) display identically on web, Android, and iOS, and match the
  conventions in FR-010–FR-016.
- **SC-003**: For a user holding two roles, the menu shows the union of both roles' modules with
  zero duplicates and zero entries outside those roles, on every app.
- **SC-004**: 100% of attempts to open a screen or perform an action outside the user's roles are
  refused, including attempts that bypass the menu.
- **SC-005**: An app below the minimum supported version shows "Update required" within 3 seconds
  of opening, and no work screen is reachable from it.
- **SC-006**: A failure of any essential part shows as "Down" on the status page within 1 minute;
  when the platform as a whole cannot serve requests, the public health address reports "down"
  within the same minute.
- **SC-007**: Creating 1,000 records of one kind concurrently yields 1,000 distinct, consecutive
  numbers with no duplicates and no reuse.
- **SC-008**: The home screen opens in under 3 seconds on a 4G connection on a mid-range Android
  phone.

## Assumptions

- The technology choices recorded in the constitution apply: a web app and a backend sharing one
  versioned interface, and one React Native app built for Android and iOS, kept in this single
  repository with shared types between them. The exact folder layout is decided in
  `/speckit-plan` for this feature and then binds features 002–011.
- Sign-in in this feature is the minimum needed to use the shell (Super Admin only, username and
  password). Feature 002 extends it without changing the conventions set here.
- Mobile apps in this feature are distributed for internal testing only (Play internal testing
  and TestFlight); public store release is feature 011.
- India is the only operating country at launch: IST, ₹, and +91 are fixed, not per-user settings.
- The home screen in this feature shows a welcome message, the user's name and roles, and the
  menu; dashboards are added by feature 009.
- Record numbers for kinds delivered later (events, damage reports, counts, transfers, items) are
  fixed here so every feature uses the same scheme; each sequence is created when its feature ships.
- Out of scope for this feature: any business module, offline use, push notifications (008), and
  languages other than English.
