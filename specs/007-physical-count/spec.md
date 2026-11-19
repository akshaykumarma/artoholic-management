# Feature Specification: Physical Counts & Stock Adjustments

**Feature Branch**: `007-physical-count`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "007-physical-count from docs/PRD-v1.1-source.md §6.2 (PHC-01 to PHC-08): Admin-defined count schedules (weekly, monthly, quarterly, half-yearly, yearly) with start date, scope (all items or chosen warehouses/categories) and assigned Store Managers; count sessions created on the due date and ad-hoc; count sheets in walking order with blind count by default; counted quantities per item and bin (per piece for cut products) with photo and note, save and resume; variance per line in quantity and ₹; Admin approves or rejects each variance line (rejected lines recounted), approved lines post adjustment entries; flag items with live event movements; escalate counts not submitted 3 days after due."

## Overview

Stock records drift unless they are checked against the shelves. This feature lets Admins
schedule regular physical counts, gives Store Managers a count sheet on their phone, shows the
differences between counted and recorded stock, and lets an Admin approve each difference before
it changes the ledger.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin schedules regular counts (Priority: P1)

An Admin creates a count schedule: name, frequency (weekly, monthly, quarterly, half-yearly,
yearly), start date, scope (all items, or chosen warehouses and/or categories), assigned Store
Managers, and whether the count is blind (default) or shows the recorded quantity.

**Why this priority**: The owner's draft requires a schedule set up by the Admin.

**Independent Test**: Create a monthly schedule for warehouse Main starting 01-12-2026; confirm
the next due date shows 01-12-2026 and then 01-01-2027.

**Acceptance Scenarios**:

1. **Given** a schedule starting on the 31st with monthly frequency, **When** a month has fewer
   days, **Then** the count falls on that month's last day.
2. **Given** a schedule, **When** an Admin pauses it, **Then** no sessions are created until it is
   resumed; resuming does not create sessions for the paused period.

---

### User Story 2 - Count sessions appear and assignees are told (Priority: P1)

On the due date (07:00 IST) the platform creates a count session `CNT-YYYY-NNNN` for the
schedule's scope and notifies the assignees. Admins can also start an ad-hoc count at any time
with the same options.

**Independent Test**: Start an ad-hoc count for category "Lighting" in Main; confirm the session
lists every lighting item with stock in Main, by bin.

**Acceptance Scenarios**:

1. **Given** a due schedule, **When** 07:00 IST on the due date passes, **Then** exactly one
   session exists for it and each assignee is notified.
2. **Given** a session, **When** created, **Then** it snapshots the recorded quantity per item,
   bin and condition (Available, Reserved and Damaged stock physically in bins; Out stock is at events and excluded).

---

### User Story 3 - Store Manager counts on the phone (Priority: P1)

The Store Manager opens the count sheet, which lists items by bin in walking order. In a blind
count the recorded quantity is hidden. They enter the counted quantity per item and bin (per
piece and length for cut products), optionally with a photo and note, save and resume as often as
needed, and submit when done.

**Independent Test**: Count 30 lines across 2 sessions on a phone, closing the app in between;
confirm nothing is lost and submit works.

**Acceptance Scenarios**:

1. **Given** a blind count, **When** the sheet is open, **Then** recorded quantities are not shown
   to the counter anywhere in the app.
2. **Given** an item found in a bin where the record says there is none, **When** the counter adds
   it, **Then** a new line is created for that item and bin.
3. **Given** an item that has an event dispatch or return in progress, **When** the sheet shows
   it, **Then** it is flagged "event movement in progress" so the counter can note it.
4. **Given** lines left uncounted, **When** the counter submits, **Then** they must confirm that
   uncounted lines mean zero found, or count them first.

---

### User Story 4 - Admin reviews variances and approves adjustments (Priority: P1)

After submission, the Admin sees every line's variance (counted − recorded) in quantity and in ₹
(at replacement value), sorted by ₹ impact, and approves or rejects each line with a reason.
Approved lines post adjustment entries to the ledger; rejected lines go back for a recount.

**Independent Test**: Submit a count with variances −3 and +2; approve the −3 and reject the +2;
confirm a −3 adjustment entry referencing the session and a recount task for the +2 line.

**Acceptance Scenarios**:

1. **Given** a submitted session, **When** the Admin opens it, **Then** lines with zero variance
   are marked matched and need no decision.
2. **Given** an approved line, **When** posted, **Then** the adjustment uses the recorded quantity
   at the time of counting plus any movements since, so stock that moved after counting is not
   counted twice.
3. **Given** a rejected line, **When** recounted and resubmitted, **Then** it returns to the
   Admin for a decision.
4. **Given** every line decided, **When** the last decision is made, **Then** the session becomes
   Completed and its report (009, R7) is available.

---

### User Story 5 - Missed counts are escalated (Priority: P2)

If a session is not submitted 3 days after its due date, Admins are notified daily until it is.

**Acceptance Scenarios**:

1. **Given** a session due 01-12-2026 not submitted, **When** 04-12-2026 07:00 IST passes,
   **Then** Admins are notified that it is overdue.

### Edge Cases

- A schedule's scope includes a warehouse later deactivated: sessions skip it and note why.
- Two Store Managers count the same session: entries merge by line; the same line edited by both
  keeps the latest and shows who changed it.
- A new session is due while the previous one for the same schedule is still open: the new one
  is still created; the old one stays open and overdue.
- A count of a cut product records each piece's length; a piece not found is counted as zero.
- An adjustment that would make stock negative (because of movements since the count) is refused
  with an explanation and the line goes back for recount.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (PHC-01): Admins MUST manage count schedules with frequency, start date, scope,
  assignees, blind flag and pause/resume.
- **FR-002** (PHC-02): Sessions MUST be created at 07:00 IST on due dates and on demand, numbered
  `CNT-YYYY-NNNN`, and assignees notified.
- **FR-003** (PHC-03): Count sheets MUST list lines by bin in walking order (bin code order) and
  hide recorded quantities in blind counts.
- **FR-004** (PHC-04): Counters MUST enter counted quantity per line (per piece for cut products)
  with optional photo and note, and save and resume.
- **FR-005** (PHC-05): On submission, variance per line in quantity and ₹ MUST be shown.
- **FR-006** (PHC-06): Admins MUST approve or reject each non-zero variance line with a reason;
  approvals post adjustment ledger entries referencing the session; rejections trigger recount.
- **FR-007** (PHC-07): Lines for items with event movements in progress MUST be flagged.
- **FR-008** (PHC-08): Sessions not submitted 3 days after due MUST be escalated daily to Admins.
- **FR-009**: Count entries MUST be kept on the device as drafts (constitution IV).
- **FR-010**: Every schedule change, session submission and decision MUST be audited.

### Key Entities

- **Count schedule**: name, frequency, start date, next due date, scope (warehouses, categories),
  assignees, blind flag, status (active, paused).
- **Count session**: number, schedule (or ad-hoc), due date, status (open, submitted, in review,
  completed), snapshot time, assignees.
- **Count line**: session, item or piece, bin, condition, recorded quantity at snapshot, counted
  quantity, photo, note, counted by, variance, decision, reason, decided by, adjustment entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Store Manager can count 100 lines on a phone in under 30 minutes.
- **SC-002**: Physical-count variance is ≤ 2% by the third scheduled count (PRD O1).
- **SC-003**: 100% of approved variances appear as adjustment entries within 5 seconds of the
  decision.
- **SC-004**: 100% of scheduled sessions are created on their due date.

## Assumptions

- Stock movements are not frozen during a count; the adjustment rule in User Story 4 handles
  movements after the snapshot.
- Counts include all stock physically in bins (Available, Reserved and Damaged); Out stock is at
  events and is reconciled by 006, not counted.
