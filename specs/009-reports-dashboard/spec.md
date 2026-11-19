# Feature Specification: Reports & Admin Dashboard

**Feature Branch**: `009-reports-dashboard`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "009-reports-dashboard from docs/PRD-v1.1-source.md §6.6 (RPT-01 to RPT-05) and §11 (R1–R10 and Admin dashboard): every report runnable on demand with filters, viewable on screen and downloadable as Excel; schedules (daily, weekly on a day, monthly on a date) with time, filters and recipients — Admins only (owner decision Q13); scheduled delivery as .xlsx by WhatsApp document and email attachment with logging and 3 retries; managers can run reports limited to their warehouses or events; Admin dashboard."

## Overview

Admins need to know what stock they have, what is out, what was damaged and what is waiting on
them — without compiling spreadsheets. This feature provides ten standard reports, each runnable
on demand and on a schedule, delivered as Excel files on WhatsApp and email, plus an Admin
dashboard.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run any report on demand (Priority: P1)

A user opens Reports, picks a report, sets filters (date range, warehouse, category, event, user
as applicable), views the result on screen and downloads it as Excel.

**Why this priority**: The owner's draft requires on-demand reports; it is also the base for
schedules.

**Independent Test**: Run "Stock on hand" for warehouse Main; confirm on-screen totals equal the
item views and the downloaded .xlsx has the same rows.

**Acceptance Scenarios**:

1. **Given** a report with 5,000 rows, **When** run, **Then** the first page shows within 5
   seconds and the Excel downloads within 30 seconds.
2. **Given** a Store Manager, **When** they run any report, **Then** it covers only their assigned
   warehouses; an Event Manager's covers only their events.
3. **Given** an Excel export, **When** opened, **Then** dates are DD-MM-YYYY, money is in ₹ with
   numeric cells (so sums work), and the header row names the report, filters and generated time
   in IST.

---

### User Story 2 - Admin schedules reports to WhatsApp and email (Priority: P1)

An Admin creates a schedule: report, filters, frequency (daily; weekly on a chosen day; monthly on
a chosen date), time (IST), and recipients chosen from Admin users only (owner decision Q13).
At the time, each recipient receives the .xlsx as a WhatsApp document and an email attachment.

**Independent Test**: Schedule "Pending approvals" daily at 09:00 IST to two Admins; confirm both
receive the file on WhatsApp and email by 09:15 IST and the deliveries are logged.

**Acceptance Scenarios**:

1. **Given** a schedule for the 31st monthly, **When** a month has fewer days, **Then** it runs on
   that month's last day.
2. **Given** a delivery failure, **When** it happens, **Then** it retries up to 3 times and then
   notifies the Super Admin; the log shows each attempt.
3. **Given** a non-Admin user, **When** an Admin tries to add them as a recipient, **Then** they
   are not offered.
4. **Given** a report with no rows, **When** its schedule runs, **Then** the file is still sent
   with a "No data for this period" row.

---

### User Story 3 - Admin dashboard (Priority: P2)

Admins see on their home screen: today's and this week's dispatches and returns, events by
status, pending approvals (damage, variances, write-offs, stock corrections, transfer shortfalls), damage value this
month, low-stock items, over-booked events, and the next scheduled counts — each linking to the
underlying list.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** a new damage report arrives, **Then** "Pending approvals"
   updates within 1 minute without reloading.
2. **Given** any figure, **When** tapped, **Then** the list behind it opens with matching filters.

### Report catalogue

| # | Report | Key columns | Suggested schedule |
| --- | --- | --- | --- |
| R1 | Stock on hand | Item, code, category, warehouse, bin, available, reserved, out, damaged, value ₹ | Weekly, Monday 08:00 |
| R2 | Stock movement ledger | Date, item, type, quantity, from, to, user, reference, reason | On demand |
| R3 | Event item status | Event, item, planned, dispatched, received, returned, handed over, damaged, lost, consumed, gap | Daily 20:00 |
| R4 | Damage and loss | Date, number, event, item, quantity, kind, reason, value ₹, reporter, decision, decided by | Weekly and monthly |
| R5 | Pending approvals | Type, number, event or count, item, quantity, waiting since | Daily 09:00 |
| R6 | Upcoming dispatches and returns (7 days) | Date, event, warehouse, lines, managers, status, over-booked | Daily 07:00 |
| R7 | Physical count variance | Session, item, bin, recorded, counted, variance, value ₹, decision | After each count |
| R8 | Item utilisation | Item, events used, days out, idle days, last used | Monthly |
| R9 | Low and dead stock | Item, available, minimum, last used | Weekly |
| R10 | User activity | User, actions by type, events, approvals, last sign-in | Monthly |

### Edge Cases

- A schedule's recipient is deactivated: they are dropped from the schedule and the schedule's
  owner Admin is told.
- Excel files larger than the WhatsApp document limit (100 MB) are sent as a link by email only,
  with a WhatsApp text saying where to find it.
- A scheduled run overlaps the previous one still generating: the new run waits; runs are never
  skipped silently.
- Reports read from the ledger as of the run time; a report regenerated later for the same period
  may differ if corrections were posted, and the file shows its generation time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (RPT-01): Every report in the catalogue MUST run on demand with filters, display on
  screen with paging, and export to .xlsx.
- **FR-002** (RPT-02, Q13): Admins MUST manage schedules (report, filters, frequency, time IST,
  recipients limited to Admin users).
- **FR-003** (RPT-03): Scheduled runs MUST deliver the .xlsx by WhatsApp document and email
  attachment to each recipient.
- **FR-004** (RPT-04): Each delivery MUST be logged with status and retried up to 3 times; failure
  notifies the Super Admin.
- **FR-005** (RPT-05): Store and Event Managers MUST be able to run reports limited to their
  warehouses or events; they cannot create schedules.
- **FR-006**: The Admin dashboard MUST show the figures in User Story 3, refreshing at least every
  minute.
- **FR-007**: Excel exports MUST follow the display conventions of 001 and use numeric cells for
  quantities and money.
- **FR-008**: Reports MUST be available on phones for viewing and sharing the Excel file.

### Key Entities

- **Report definition**: report type, filters.
- **Report schedule**: definition, frequency, day/date, time, recipients, owner Admin, status.
- **Report run**: schedule (or on-demand user), started, finished, row count, file, deliveries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ≥ 99% of scheduled reports are delivered within 15 minutes of their time (PRD O6).
- **SC-002**: 100% of report figures match the ledger at generation time (verified per report).
- **SC-003**: An Admin can set up a new schedule in under 2 minutes.
- **SC-004**: The dashboard loads in under 3 seconds on 4G.

## Assumptions

- WhatsApp and email delivery and logging are provided by 008.
- Reports R1–R7 are Must for the MVP; R8–R10 are Should and may slip to Phase 2 if time runs out
  (PRD §11 priorities).
