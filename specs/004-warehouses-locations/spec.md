# Feature Specification: Warehouses & Locations

**Feature Branch**: `004-warehouses-locations`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "004-warehouses-locations from docs/PRD-v1.1-source.md §6.3 (WHS-01 to WHS-08): warehouses with name, code, address, map pin, contact, several Store Managers each (owner decision Q1); user-defined location levels per warehouse (1–5 levels, e.g. Aisle → Row → Box); single and bulk location creation with readable codes; stock held per bin; moves within a warehouse; transfers between warehouses with in-transit stock; locations with stock cannot be deleted; QR labels later."

## Overview

Artoholic stores stock in several warehouses, each organised its own way. This feature lets
Admins describe each warehouse and its storage layout, so every quantity in the ledger points at
a specific bin (for example `MAIN-A-03-02`: warehouse Main, Aisle A, Row 3, Box 2). Store
Managers use it to put stock away, move it, and transfer it between warehouses. Areas inside a
warehouse are modelled as location levels, not sub-warehouses (owner decision Q1).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin sets up a warehouse and its layout (Priority: P1)

An Admin creates a warehouse with name, short code, address, map pin, contact phone and its
Store Managers, then names its location levels (for example Aisle, Row, Box).

**Why this priority**: Every stock quantity needs a warehouse and bin.

**Independent Test**: Create warehouse "Main" (code `MAIN`) with levels Aisle → Row → Box and two
Store Managers; confirm both managers see it and others do not.

**Acceptance Scenarios**:

1. **Given** an Admin, **When** they create a warehouse with code `MAIN`, **Then** the code is
   upper-cased, must be 2–8 letters or digits, and must be unique.
2. **Given** a warehouse, **When** levels are defined, **Then** 1 to 5 named levels are allowed,
   in order from largest to smallest.
3. **Given** a warehouse with locations already created, **When** an Admin tries to change the
   number of levels, **Then** it is refused; renaming a level is allowed.
4. **Given** two Store Managers assigned to Main, **When** either signs in, **Then** both see
   Main's stock and tasks; a Store Manager assigned only to "North" does not.

---

### User Story 2 - Create bins one by one or in bulk (Priority: P1)

A Store Manager or Admin creates locations inside the levels, one at a time or in bulk ranges
("Aisle A, Rows 1–10, Boxes 1–5"). Each bin gets a readable code built from the warehouse code
and its levels.

**Why this priority**: Real warehouses have hundreds of bins; one-by-one entry is impractical.

**Independent Test**: Bulk-create Aisle A, Rows 1–3, Boxes 1–2 in Main and confirm 6 bins with
codes `MAIN-A-01-01` … `MAIN-A-03-02`.

**Acceptance Scenarios**:

1. **Given** the bulk form with ranges, **When** submitted, **Then** a preview shows how many
   bins will be created (max 2,000 per request) and which already exist (skipped).
2. **Given** numeric parts, **When** codes are built, **Then** numbers are zero-padded to the
   width of the largest number in the range (Rows 1–10 → `01`…`10`).
3. **Given** an existing bin, **When** a duplicate code would result, **Then** it is skipped and
   reported, not duplicated.

---

### User Story 3 - Put away and move stock between bins (Priority: P1)

A Store Manager puts newly received stock into bins and moves stock from one bin to another in
the same warehouse. Each move is a ledger entry.

**Independent Test**: Move 10 chairs from `MAIN-A-01-01` to `MAIN-B-02-01`; confirm the item view
shows the new split and the ledger shows the move.

**Acceptance Scenarios**:

1. **Given** 25 chairs in a bin, **When** 10 are moved, **Then** 15 remain and 10 appear in the
   target bin, in one ledger entry.
2. **Given** a move of more than the bin holds, **When** submitted, **Then** it is refused.
3. **Given** the default location created by 003, **When** a warehouse gets real bins, **Then**
   stock in the default location can be moved into bins and the default location deactivated when
   empty.

---

### User Story 4 - Transfer stock between warehouses (Priority: P2)

A Store Manager or Admin requests a transfer from one warehouse to another. The sending
Store Manager dispatches it, the stock shows as in transit, and the receiving Store Manager
receives it into bins. Shortfalls on receipt are reported.

**Why this priority**: Needed when an event draws on a warehouse that lacks stock; events can
still split lines across warehouses without it (005).

**Independent Test**: Transfer 20 chairs Main → North; dispatch, then receive 19; confirm 1 is
flagged missing and goes to Admin for a decision.

**Acceptance Scenarios**:

1. **Given** a transfer request `TRF-2026-0001`, **When** dispatched, **Then** the quantity
   leaves Main's bins and shows as "In transit to North", counted in neither warehouse's Available.
2. **Given** an in-transit transfer, **When** North receives fewer than dispatched, **Then** the
   difference must be confirmed as missing and an Admin decides (lost, or returned to Main).
3. **Given** any transfer, **When** viewed, **Then** it shows requested, dispatched and received
   quantities, people and times.

---

### User Story 5 - Keep the layout tidy (Priority: P3)

Admins and assigned Store Managers deactivate empty bins and rename them. Bins with stock cannot
be deleted or deactivated.

**Acceptance Scenarios**:

1. **Given** a bin holding any stock (any condition), **When** someone tries to deactivate it,
   **Then** it is refused, showing what it holds.
2. **Given** an empty bin, **When** deactivated, **Then** it no longer appears in put-away choices
   but stays in history.

### Edge Cases

- A warehouse with no active Store Manager still shows in Admin views with a warning.
- A warehouse cannot be deactivated while it holds stock or has open transfers or event lines.
- Location codes are unique within the platform (they include the warehouse code).
- A warehouse code cannot change once bins exist (codes are printed on labels).
- Transfers can be cancelled only before dispatch; reservations made by events are not moved by
  transfers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (WHS-01): Admins MUST manage warehouses with name, code, address, map pin, contact
  phone, status and assigned Store Managers (many-to-many).
- **FR-002** (WHS-02): Each warehouse MUST have 1–5 user-named location levels.
- **FR-003** (WHS-03): Admins and assigned Store Managers MUST be able to create locations singly
  or in bulk ranges with automatic readable codes `<WAREHOUSE>-<L1>-<L2>-…`.
- **FR-004** (WHS-04): Stock MUST be held per bin (lowest-level location); the item view MUST show
  quantity per bin.
- **FR-005** (WHS-05): Store Managers MUST be able to move stock between bins in a warehouse as a
  ledger entry.
- **FR-006** (WHS-06): Transfers between warehouses MUST follow request → dispatch → receive, with
  in-transit stock shown separately and receipt shortfalls decided by an Admin.
- **FR-007** (WHS-07): Locations holding stock MUST NOT be deleted or deactivated.
- **FR-008**: Every create, edit, move and transfer step MUST be audited.
- **FR-009**: Put-away screens on phones MUST let the user pick a bin by typing part of its code,
  with the item's usual bins suggested first.
- **FR-010** (WHS-08, later phase): Printable QR labels for bins are out of scope for this feature
  (owner decision Q6); bin codes MUST be designed to print later.

### Key Entities

- **Warehouse**: code, name, address, map pin, contact, status, level names, Store Managers.
- **Location**: code, warehouse, level, parent location, name/number, status.
- **Stock transfer**: number `TRF-YYYY-NNNN`, from/to warehouse, lines (item or piece, requested,
  dispatched, received), status (requested, dispatched, received, cancelled), people and times.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A warehouse with 500 bins can be laid out in under 10 minutes using bulk creation.
- **SC-002**: A Store Manager can move stock between two bins on a phone in under 20 seconds.
- **SC-003**: 100% of stock is held in a bin (no quantities without a location) after migration
  from default locations.
- **SC-004**: In-transit quantities are never counted as Available in either warehouse.

## Assumptions

- Warehouse map pins use the same maps integration as event venues (PRD §9).
- Transfers do not need approval to be requested; shortfalls do.
- Only Admins create warehouses; Store Managers manage bins in their assigned warehouses.
