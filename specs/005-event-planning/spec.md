# Feature Specification: Event Planning & Reservations

**Feature Branch**: `005-event-planning`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "005-event-planning from docs/PRD-v1.1-source.md §6.4 (EVT-01 to EVT-08, EVT-20, EVT-25, EVT-26): Admin creates an event with name, description, venue and map pin, start/end date-time, leave-warehouse date, expected return date, event type, site contact, notes, one or more Event Managers and Store Managers, and required items with quantity and source warehouse (splittable); availability check over the date window with an over-booking warning to the event's Admin, Event Managers and Store Managers (owner decision Q4); stock reserved on save and released on cancel; copy event as template; notify assignees to start dispatch; event status state machine; list, calendar and today views; reminders. No client details (owner decision Q5)."

## Overview

An event is a plan with dates, a venue, its managers and the items it needs. Saving it reserves
the stock for the event's date window (leave-warehouse date → expected return date) so other
events see it as taken. If an event needs more than is available, it can still be saved, but
everyone involved is warned. The four-step checklist that moves the items is feature 006.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates an event and reserves its items (Priority: P1)

An Admin creates an event: name, type, description, venue (name, address, map pin), start and
end date-time, leave-warehouse date (and time), expected return date, site contact, notes, one or
more Event Managers, one or more Store Managers, and the required items with quantity (length for
cut products) and source warehouse. Saving gives it a number such as `EVT-2026-0001` and reserves
the stock.

**Why this priority**: Events are the reason the platform exists; reservations prevent the same
chairs being promised twice.

**Independent Test**: Create an event needing 50 chairs from Main; confirm the chairs show as
Reserved for that event and available drops by 50 for overlapping dates only.

**Acceptance Scenarios**:

1. **Given** the event form, **When** saved without a name, venue, start, end, leave-warehouse
   date, expected return date, at least one Event Manager or at least one item, **Then** it is
   refused naming each missing field. (A Draft may be saved with any fields missing.)
2. **Given** leave-warehouse date after start, or expected return date before end, **When**
   saved, **Then** it is refused with the reason.
3. **Given** a saved event, **When** its number is shown, **Then** it follows `EVT-YYYY-NNNN`
   using the IST year of creation.
4. **Given** an item line, **When** the Admin picks the item, **Then** the platform suggests the
   warehouse with the most available stock for the window and lets the Admin split the line across
   warehouses.
5. **Given** a saved event, **When** its lines reference warehouses, **Then** the Store Managers
   of those warehouses are suggested as the event's Store Managers; the Admin can change them.

---

### User Story 2 - Over-booking is allowed with a warning to everyone involved (Priority: P1)

While adding items, the Admin sees available stock for the event's date window after other
events' reservations. If a line needs more than is available, the event can still be saved, but
it carries an over-booking warning naming the short items, the shortfall and the clashing events,
and the warning goes to the event's Admin(s), Event Manager(s) and Store Manager(s) (owner
decision Q4).

**Why this priority**: The owner chose warn-not-block; the warning is the only protection
against double-booking.

**Independent Test**: With 100 chairs and 80 reserved by an overlapping event, add 30 chairs to a
new event; confirm "20 available — 10 short" on the line, the save succeeds, and the three groups
are notified.

**Acceptance Scenarios**:

1. **Given** an overlapping reservation, **When** a line exceeds availability, **Then** the line
   shows available, required and shortfall before saving.
2. **Given** an over-booked event is saved, **When** saved, **Then** it shows a visible
   over-booking banner, and the warning is sent to its Admin(s), Event Manager(s) and Store
   Manager(s), and also listed on each clashing event.
3. **Given** the shortfall is later resolved (quantity reduced, stock added, or the clashing event
   changed or cancelled), **When** availability is recalculated, **Then** the warning clears
   automatically and the same people are told it is resolved.
4. **Given** an over-booked event, **When** the leave-warehouse date arrives unresolved, **Then**
   Admins are reminded the morning of that date.

---

### User Story 3 - Assignees are told to start dispatch (Priority: P1)

When an event is saved as Scheduled (or its managers change), the assigned Event Manager(s) and
Store Manager(s) are notified in the app, by push and by WhatsApp, with a link to the event.

**Independent Test**: Save an event and confirm each assignee receives the notification with the
event number, name, leave-warehouse date and a working link.

**Acceptance Scenarios**:

1. **Given** a newly scheduled event, **When** saved, **Then** each assignee is notified once.
2. **Given** dates, items or managers change, **When** saved, **Then** assignees are notified of
   what changed; removed managers are told they are no longer assigned.

---

### User Story 4 - Edit, cancel and copy events (Priority: P2)

Before dispatch, an Admin can change any field; reservations follow the changes. An Admin can
cancel an event before dispatch, which releases all its reservations. An Admin can copy any event
as a new one with the same items and quantities and new dates.

**Acceptance Scenarios**:

1. **Given** a Scheduled event, **When** a line's quantity changes from 50 to 40, **Then** the
   reservation drops to 40 immediately.
2. **Given** a Scheduled event, **When** cancelled with a reason, **Then** all reservations are
   released, assignees are notified, and the event shows Cancelled.
3. **Given** an event in Dispatching or later, **When** an Admin tries to cancel, **Then** it is
   refused; items must come back through the checklist (006).
4. **Given** an event copied as a template, **When** the copy is opened, **Then** it is a Draft
   with the same items and quantities, no dates, and the same managers.

---

### User Story 5 - See what's coming (Priority: P2)

Users see events as a list and a month calendar, filtered by status, date range, type, manager
and warehouse. A "Today" view shows the dispatches and returns due today. Event and Store
Managers see only the events they are assigned to.

**Acceptance Scenarios**:

1. **Given** a Store Manager, **When** they open Today, **Then** they see events whose
   leave-warehouse date or expected return date is today and involves their warehouses.
2. **Given** an Admin, **When** they filter by "over-booked", **Then** only events with an active
   warning are listed.

---

### User Story 6 - Reminders before deadlines (Priority: P3)

Store Managers are reminded 24 hours before the leave-warehouse date if dispatch is not
submitted; Event Managers are reminded on the expected return date if the return is not
dispatched.

**Acceptance Scenarios**:

1. **Given** an event leaving tomorrow at 09:00 IST with dispatch not submitted, **When** it is
   09:00 IST today, **Then** its Store Managers get a reminder.

### Edge Cases

- Event types are an Admin-editable list (initially Wedding, Engagement or Reception, Birthday or
  Private party, Corporate event, Conference or Exhibition, Concert or Cultural show, Political
  rally or Public meeting, Religious or Community function, Other).
- Two Admins edit the same event at once: the second save is refused with "This event changed
  since you opened it" and shows the newer version.
- A cut-product line asks for total length; specific pieces are chosen at dispatch (006).
- Archived items cannot be added to new events; existing lines keep them.
- An event with no Store Manager on a line's warehouse saves with a warning on that line.
- A date window that touches another event's window on the same day counts as overlapping.
- Events spanning midnight or multiple days: start/end times are in IST; the window uses calendar
  dates in IST.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (EVT-01): Admins MUST create events with name, description, venue (name, address, map
  pin), start and end date-time, leave-warehouse date and time, Event Manager(s), Store Manager(s)
  and required items.
- **FR-002** (EVT-02): Events MUST also carry type, expected return date, site contact (name,
  phone) and notes. Client details are not captured (owner decision Q5).
- **FR-003** (EVT-03): Each line MUST hold item, quantity (or total length) and source warehouse;
  the platform MUST suggest a warehouse and allow splitting a line across warehouses.
- **FR-004** (EVT-04): The platform MUST compute availability per item and warehouse for the
  window (leave-warehouse date → expected return date) net of other events' reservations; when a
  line exceeds it, the event MAY be saved but MUST carry an over-booking warning sent to the
  event's Admin(s), Event Manager(s) and Store Manager(s), which clears automatically when resolved.
- **FR-005** (EVT-05): Saving a Scheduled event MUST reserve its stock via ledger entries; edits
  before dispatch MUST adjust reservations; cancelling MUST release them.
- **FR-006** (EVT-06): Store Managers of the lines' warehouses MUST be suggested.
- **FR-007** (EVT-07): Admins MUST be able to copy an event as a Draft.
- **FR-008** (EVT-08): Scheduling an event or changing its assignments MUST notify assignees
  (in-app, push, WhatsApp).
- **FR-009** (EVT-20): Event status MUST follow Draft → Scheduled → Dispatching → In transit →
  At site → Returning → Reconciling → Closed, with Cancelled possible from Draft or Scheduled only.
  This feature moves events between Draft, Scheduled and Cancelled; 006 drives the rest.
- **FR-010** (EVT-25): List, calendar and Today views with the filters in User Story 5; managers
  see only assigned events.
- **FR-011** (EVT-26): Reminders as in User Story 6.
- **FR-012**: Every create, edit, cancel and assignment change MUST be audited with before/after
  values; editing a Scheduled event MUST detect concurrent edits.
- **FR-013**: Only Admins (and the Super Admin) MAY create, edit, cancel or copy events.

### Key Entities

- **Event**: number, name, type, description, venue name, address, map pin, start, end,
  leave-warehouse date-time, expected return date, site contact, notes, status, over-booking state.
- **Event assignment**: event × user × role on the event (Event Manager / Store Manager) ×
  warehouse (for Store Managers).
- **Event line**: event, item, source warehouse, planned quantity (or length), reserved quantity;
  006 adds dispatched, received, returned, damaged, lost, consumed.
- **Over-booking warning**: event, line, shortfall, clashing events, raised and resolved times.
- **Event type**: Admin-editable list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Admin can create a 30-line event in under 10 minutes, or under 2 minutes by
  copying a previous event.
- **SC-002**: Availability for a line is shown within 1 second of choosing the item.
- **SC-003**: 100% of over-booked events have a visible warning and a notification to every
  assignee within 2 minutes of saving.
- **SC-004**: 100% of over-booking warnings resolved before the leave-warehouse date are
  reflected (warning cleared) within 2 minutes of the change that resolves them.
- **SC-005**: Reservations always equal the sum of Scheduled events' planned quantities
  (verified by a reconciliation check).

## Assumptions

- Notifications are delivered by 008; until it ships, in-app notifications only.
- Venue maps use Google Maps place search and a navigation link (PRD §9).
- A Draft event reserves nothing and notifies no one.
- Admins are always considered "the event's Admins" for warnings; an event has no single owner
  Admin.
