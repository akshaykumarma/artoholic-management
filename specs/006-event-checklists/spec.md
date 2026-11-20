# Feature Specification: Event Checklists, Damage Approval & Closure

**Feature Branch**: `006-event-checklists`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "006-event-checklists from docs/PRD-v1.1-source.md §6.4 (EVT-10 to EVT-17, EVT-21 to EVT-24, EVT-27) and §5: the four-step checklist — warehouse dispatch (Store Manager, quantities in the same table, short-dispatch reasons, optional vehicle number / driver name / driver phone per owner decision Q8), site receipt (Event Manager, received and damaged with photos, missing confirmed), return dispatch (Event Manager, returned, consumed, remaining length, damage), warehouse receipt (Store Manager, put-away bins); Admin damage review with photo evidence (any Admin, Q3), approve or reject; closure only when every line is reconciled and every review decided; Admin edits to closed events as correction entries; extra dispatch rounds; who/when/device/GPS per step; photo compression; damage photos kept 6 months and damage records forever (Q12)."

## Overview

This feature moves an event's items from the warehouse to the site and back, with a count at
every handover. Each step is a checklist built from the event's lines. Damage or shortfall at any
step goes to an Admin, who reviews the photos and decides. An event closes only when every item
dispatched is accounted for. This is the core of the platform; the lifecycle diagram is in
PRD §5.

## Clarifications

### Session 2026-11-19

- Q: Can items go straight from one event to another without returning to the warehouse? (decided in 005) → A: Yes — the giving event's return dispatch hands quantities to the receiving event, which records a counted site receipt.
- Q: When items go out or come back in several truckloads, is each truckload a separate counted checklist, or is the whole event counted once per step? → A: Once per step for the whole event (per warehouse for warehouse steps), with one set of vehicle and driver details per submission. Confirmed final by the owner on 2026-11-20: one entry for the whole event, trucks are not tracked.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Store Manager dispatches items from the warehouse (Priority: P1)

The Store Manager opens the event's dispatch checklist: a table of lines grouped by warehouse and
sorted by bin so picking follows the aisles. For each line they tick it and enter the quantity
dispatched in the same table (choosing specific pieces for cut products), can save part-way, and
then submit. Optional transport fields: vehicle number, driver name, driver phone.

**Why this priority**: The first handover; nothing reaches the site without it.

**Independent Test**: For an event with 3 lines, dispatch 50 chairs, 20 lights and a 12 m
carpet piece; confirm stock moves from Reserved to Out, the event becomes Dispatching then In
transit, and the Event Manager is notified.

**Acceptance Scenarios**:

1. **Given** the dispatch table, **When** a line's dispatched quantity is below planned, **Then** a
   reason is required (out of stock, damaged on pick, Admin decision, other + note) and Admins are
   notified of the short dispatch.
2. **Given** a quantity above planned, **When** entered, **Then** it is refused unless an Admin
   has added the extra to the event first.
3. **Given** a partly filled table, **When** the phone loses signal or the app closes, **Then** the
   entries are kept on the device and restored when the checklist is reopened.
4. **Given** the Store Manager submits, **When** all lines for their warehouse are done, **Then**
   stock moves Reserved → Out in one ledger entry per line, the step records who, when, device
   and (if allowed) location, and the Event Manager(s) are notified.
5. **Given** an event drawing on two warehouses, **When** only one has submitted, **Then** the
   event is Dispatching; when all have submitted it becomes In transit.

---

### User Story 2 - Event Manager receives items at the site (Priority: P1)

At the venue the Event Manager opens the same table and enters, per line, received and damaged
quantities. Damaged lines need at least one photo and a note. Missing quantity (dispatched −
received − damaged) is computed and must be confirmed.

**Why this priority**: Catches loss and damage in transit while the truck is still there.

**Independent Test**: Receive 48 good and 2 damaged chairs out of 50 with two photos; confirm a
damage report `DMG-2026-…` goes to Admins and the event becomes At site.

**Acceptance Scenarios**:

1. **Given** a damaged quantity, **When** submitted without a photo, **Then** it is refused.
2. **Given** a computed missing quantity of 1, **When** the Event Manager submits, **Then** they
   must confirm "1 missing" explicitly.
3. **Given** a submitted receipt with damage or missing, **When** it is saved, **Then** a damage
   report is created per affected line and all Admins are notified (in-app, push, WhatsApp).
4. **Given** photos taken on the phone, **When** uploaded, **Then** they are compressed (longest
   side ≤ 1600 px) and stamped with time and event number; a failed upload retries and never loses
   the rest of the entries.

---

### User Story 3 - Admin reviews damage and loss (Priority: P1)

Any Admin opens a damage report from the notification, sees the photos, note, quantities, who
reported it and where, and approves or rejects it with a comment. Approval moves the quantity to
Damaged or Lost; rejection sends the line back to the reporter to check again.

**Why this priority**: The owner's draft requires admin approval of every damage report; events
cannot close without decisions.

**Independent Test**: Approve one damage report and reject another; confirm the approved stock is
Damaged and the reporter of the rejected one is asked to re-check that line.

**Acceptance Scenarios**:

1. **Given** a pending report, **When** an Admin approves it, **Then** the quantity moves to
   Damaged (or Lost for missing) with a ledger entry referencing the report, and the reporter is
   notified.
2. **Given** a pending report, **When** an Admin rejects it with a comment, **Then** the line
   reopens for the reporter, who must re-enter quantities (and photos if still damaged).
3. **Given** two Admins open the same report, **When** one decides, **Then** the other sees it is
   already decided and cannot decide again.
4. **Given** a report approved on a phone from the push notification, **When** done, **Then** it
   takes no more than 3 taps after the report opens.

---

### User Story 4 - Return dispatch from the site (Priority: P1)

After the event, the Event Manager uses the item list as a checklist: per line, quantity sent
back, quantity consumed (measured and cut items only — for example 12 m of fabric used), remaining
length for cut pieces, and damaged quantity with photos. Submitting notifies the Store Managers.

**Independent Test**: Send back 46 chairs and report 2 damaged; send back 9 m of a 12 m carpet
piece with 3 m consumed; confirm the event becomes Returning.

**Acceptance Scenarios**:

1. **Given** a counted item, **When** consumed quantity is entered, **Then** it is refused
   (only measured and cut items can be consumed).
2. **Given** consumed quantity, **When** entered, **Then** no photo is needed.
3. **Given** new damage at return, **When** submitted, **Then** a damage report goes to Admins as
   in User Story 3.

---

### User Story 5 - Warehouse receipt and put-away (Priority: P1)

The Store Manager checks returned items against the return dispatch, enters received and damaged
quantities with photos, and chooses the bin for each line (defaulting to the item's usual bin).
Submitting returns good stock to Available.

**Independent Test**: Receive 45 of 46 chairs, put them in their usual bin; confirm 45 are
Available, 1 is a missing report, and the event becomes Reconciling.

**Acceptance Scenarios**:

1. **Given** fewer received than sent back, **When** submitted, **Then** the difference must be
   confirmed as missing and a damage/loss report is created.
2. **Given** a returned cut piece, **When** received, **Then** its current length is updated to
   the length received and the piece goes back into stock for reuse (owner decision Q2).

---

### User Story 6 - Close the event (Priority: P1)

When every line is reconciled (returned + handed over + damaged + lost + consumed = dispatched) and every damage
report has a decision, an Admin closes the event. Closing locks the checklists.

**Acceptance Scenarios**:

1. **Given** any line not reconciled or any report pending, **When** an Admin tries to close,
   **Then** it is refused, listing the lines and reports that block it.
2. **Given** everything reconciled, **When** closed, **Then** the event becomes Closed and all
   assignees are notified.

---

### User Story 7 - Admin corrects a closed event (Priority: P2)

An Admin can view and edit any event, including a closed one. Editing a closed event's
quantities needs a reason and posts correction entries; nothing is overwritten.

**Acceptance Scenarios**:

1. **Given** a closed event, **When** an Admin changes a returned quantity from 50 to 49 with a
   reason, **Then** a −1 correction entry is posted, the line shows the new value, and the activity
   log shows old value, new value, reason, who and when.

---

### User Story 8 - Add items to a live event (Priority: P3)

During the event an Admin adds items; this creates a new dispatch round that follows the same
four steps for just those lines.

**Acceptance Scenarios**:

1. **Given** an event At site, **When** an Admin adds 20 chairs, **Then** a round 2 dispatch
   checklist appears for the Store Manager with only those lines, reserved like any line.

### Edge Cases

- A step is submitted twice from two phones: the second is refused as already submitted.
- A rejected report keeps the event from closing until the reporter resubmits and an Admin
  decides.
- Damage photos are deleted 6 months after the report's decision; the damage report itself
  (item, quantity, reason, decision, who, when) is kept forever (owner decision Q12).
- GPS is recorded only if the user allows location; refusing it never blocks a step.
- A line dispatched in two warehouses is reconciled per warehouse.
- The Event Manager is also the Store Manager (multi-role user): they may perform both steps,
  each recorded under its role.
- Checklist tables with 200 lines must stay usable on a phone (search within the table, filter
  "not yet done").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (EVT-10): Warehouse dispatch checklist as in User Story 1, moving stock Reserved → Out.
- **FR-002** (EVT-11): Short dispatch MUST require a reason and notify Admins.
- **FR-003** (owner decision Q8): Dispatch MUST offer optional vehicle number, driver name and
  driver phone — one set per submission. Each step is submitted once for the whole event (per
  warehouse for warehouse steps), not per truckload; part-way saves cover loading over several
  trucks (clarification 2026-11-19).
- **FR-004** (EVT-12): Site receipt checklist as in User Story 2; damaged quantities need ≥ 1
  photo and a note; missing quantity is computed and confirmed.
- **FR-005** (EVT-13, EVT-16): Damage and missing quantities at any step MUST create a damage
  report numbered `DMG-YYYY-NNNNN`; any Admin MUST be able to approve (to Damaged or Lost) or reject
  (line reopens) with a comment; each report is decided once.
- **FR-006** (EVT-14, EVT-27): Return dispatch as in User Story 4, including consumed quantities
  for measured and cut items and remaining length for cut pieces.
- **FR-007** (EVT-15): Warehouse receipt with put-away bins as in User Story 5, returning good
  stock to Available.
- **FR-008** (EVT-17): Closure only when every line is reconciled and every report decided;
  closing locks checklists.
- **FR-008a** (direct handover, from 005 FR-003a): For lines another event is sourced from, the
  return dispatch MUST let the Event Manager hand quantities over to that event instead of the
  warehouse. The receiving event's Event Manager records receipt at their site (received, damaged
  with photos, missing confirmed) exactly like a site receipt, and that is the receiving line's
  dispatch. The giving line counts handed-over quantity as reconciled; shortfalls create damage
  reports on the giving event.
- **FR-009** (EVT-20): Event status MUST advance automatically: first dispatch submitted →
  Dispatching; all dispatches → In transit; site receipt submitted → At site; return dispatch
  submitted → Returning; all warehouse receipts → Reconciling; closed → Closed.
- **FR-010** (EVT-21): Admins MUST be able to edit closed events with a reason, posting
  correction entries and keeping old values in the activity log.
- **FR-011** (EVT-22): Each step MUST record who, when, app type and version, device, and GPS
  location when permitted.
- **FR-012** (EVT-23): Photos MUST be compressed on the device and stamped; item photos kept
  forever, damage photos kept 6 months after decision, damage records kept forever.
- **FR-013** (EVT-24): Admins MUST be able to add items to a live event as a new dispatch round.
- **FR-014**: Checklist entries MUST be saved on the device as a draft and survive app restarts,
  loss of signal and session expiry (constitution IV).
- **FR-015**: Each event MUST have an activity log showing every step, report, decision,
  correction and message sent for it (WhatsApp texts in full, one-time codes redacted).

### Key Entities

- **Dispatch round**: event, round number, the lines it covers.
- **Checklist step**: round, step type (warehouse dispatch, site receipt, return dispatch,
  warehouse receipt), warehouse (for warehouse steps), status (not started, in progress,
  submitted), submitted by, time, app/device, GPS, transport details (dispatch).
- **Event line** (extends 005): dispatched, received, returned, handed over, damaged, lost,
  consumed quantities per round and source; pieces for cut products.
- **Handover**: giving event, receiving event, lines and quantities handed over and received,
  people, times.
- **Damage report**: number, event, line, step, quantity, kind (damaged / missing), reason, note,
  photos, reporter, decision (pending / approved / rejected), decided by, comment, times.
- **Photo**: storage reference, taken time, by, size, linked record, deletion due date (damage
  photos).
- **Correction**: event, line, field, old value, new value, reason, by, time, ledger entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Store Manager can dispatch a 50-line event on a phone in under 15 minutes.
- **SC-002**: An Event Manager can record a site receipt of 50 lines with 2 damaged lines and
  photos in under 10 minutes.
- **SC-003**: Median time from damage report to Admin decision is under 24 hours (PRD O4).
- **SC-004**: 100% of closed events have every line reconciled (PRD O2).
- **SC-005**: Zero checklist entries are lost when the phone loses signal or the app restarts
  (verified by tests that kill the app mid-entry).
- **SC-006**: A 200-line checklist opens in under 2 seconds on a mid-range Android phone.

## Assumptions

- Each step is submitted once for the whole event (per warehouse for the two warehouse steps),
  not per truckload (owner decision 2026-11-19, confirmed final 2026-11-20: trucks are not
  tracked). If several trucks are used, the manager saves the table part-way as trucks are
  loaded or unloaded and submits once everything is counted.

- Offline submission (queue and sync without signal) is Phase 2; in this feature drafts are kept
  on the device but submission needs a connection.
- Damage cost recovery from clients is Phase 3; replacement value is shown on reports for
  information.
- Notifications are delivered by 008.
