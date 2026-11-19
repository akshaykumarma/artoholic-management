# Feature Specification: Catalogue & Inventory

**Feature Branch**: `003-catalogue-inventory`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "003-catalogue-inventory from docs/PRD-v1.1-source.md §6.2 (INV-01 to INV-11): categories with sub-categories, units of measure with conversions, items with three tracking types (counted, measured, cut product), photos, replacement value, minimum stock; stock held per warehouse location and condition; append-only stock ledger; cut-product pieces with offcuts reused; item view with stock by condition and location, last event, reservations and history; damage summary; write-off of damaged stock; search and filters; low-stock alert; Excel/CSV import of items and opening stock. Owner decisions: offcuts reused (Q2), consumables not tracked (Q7), repair workflow later (Q14), item photos kept forever (Q12), item codes editable (001 clarification)."

## Overview

This feature creates the catalogue of everything Artoholic owns and the stock ledger that tracks
how much of each item exists, where, and in what condition. Every later movement — event
dispatch, returns, damage, counts, transfers — is written to this ledger. Warehouse locations
themselves are defined in 004; until 004 ships, stock is held against a single default location
per warehouse.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin builds the catalogue (Priority: P1)

An Admin creates categories (with optional sub-categories), the units of measure Artoholic uses,
and items: name, code, category, description, tracking type, unit (none for counted items),
up to 5 photos, replacement value, minimum stock level and notes.

**Why this priority**: Nothing can be stocked, reserved or dispatched before items exist.

**Independent Test**: Create category "Furniture" → "Chairs", a counted item "White Chiavari
Chair", a measured item "Jute rope" in metres, and a cut product "Red carpet roll" in metres;
confirm each appears in the item list with the right unit.

**Acceptance Scenarios**:

1. **Given** a new item without a code typed, **When** it is saved, **Then** it gets the next
   code `ITM-NNNNN`; **given** an Admin types `CHR-WHITE-01`, **Then** that code is used if unused.
2. **Given** a counted item, **When** a unit of measure is chosen, **Then** the form refuses it;
   **given** a measured or cut item without a unit, **Then** the form requires one.
3. **Given** an Admin changes an item's code, **When** anyone later searches the old code,
   **Then** the item is found, and no other item can ever take the old code.
4. **Given** a category that contains items, **When** an Admin tries to delete it, **Then** they
   may only archive it; archived categories and items are hidden from new events but kept in history.
5. **Given** units "cm" and "m" in the same family with 100 cm = 1 m, **When** a quantity is
   entered in cm for an item stocked in m, **Then** it is converted and stored in m.

---

### User Story 2 - Load opening stock and see what we have (Priority: P1)

An Admin or Store Manager enters opening stock per warehouse and condition, one by one or by
importing an Excel/CSV template, and then sees for every item how much is Available, Reserved,
Out, Damaged, Lost and Written off.

**Why this priority**: Accurate opening stock is the starting point of every availability check
(risk K3 in the PRD).

**Independent Test**: Import a 50-row template with one deliberate error; confirm the dry-run
preview lists the error row, fix it, import, and confirm the item view totals match the file.

**Acceptance Scenarios**:

1. **Given** an import file, **When** it is uploaded, **Then** a dry-run preview shows rows to be
   created and every row error (with row number and reason) before anything is saved.
2. **Given** a confirmed import, **When** it completes, **Then** each stock row becomes an
   "opening stock" ledger entry, and the import can be identified in the ledger by its reference.
3. **Given** stock entered, **When** the item view opens, **Then** on-hand = Available + Reserved
   + Out + Damaged, broken down by condition and by warehouse/location; Lost and Written off are
   shown separately and not counted as on hand.

---

### User Story 3 - Every stock change is in the ledger (Priority: P1)

Any change to stock — opening stock, receipt, dispatch, return, adjustment, damage, write-off,
cut, transfer, correction — is recorded as a ledger entry with item (or piece), quantity, from
and to location and condition, reason, who, when, and the related event, count or transfer.
Quantities can never be typed over.

**Why this priority**: Constitution principle II; later features (005–007) only work through it.

**Independent Test**: Post a manual adjustment of −3 chairs with a reason; confirm the item view
total drops by 3 and the ledger shows the entry with the user, reason and time.

**Acceptance Scenarios**:

1. **Given** any stock screen, **When** a user looks for a way to edit a quantity directly,
   **Then** there is none; changes are made only by recording a movement.
2. **Given** a ledger entry, **When** anyone tries to change or delete it, **Then** the platform
   refuses; a mistake is fixed by a correction entry referencing the original, with a reason.
3. **Given** a movement that would make any condition negative at a location, **When** it is
   submitted, **Then** it is refused naming the item, location and available quantity.

---

### User Story 4 - Cut products are tracked piece by piece (Priority: P1)

For carpet, fabric and other cut products, each roll or piece has its own record with original
and current length and location. Cutting a length for an event creates the cut piece and keeps
the offcut in stock for reuse; pieces shorter than the item's minimum usable length can be
written off.

**Why this priority**: Cut products are named in the owner's draft and cannot be tracked as
simple quantities.

**Independent Test**: Receive a 30 m carpet roll, record a 12 m cut; confirm the roll shows 18 m,
a 12 m piece exists, and the item total is still 30 m until the piece is dispatched or consumed.

**Acceptance Scenarios**:

1. **Given** a 30 m roll, **When** a 12 m cut is recorded, **Then** two pieces exist: 18 m (the
   offcut, same piece number with a suffix) and 12 m, both Available at the same location.
2. **Given** an item with minimum usable length 2 m, **When** a piece of 1.5 m remains, **Then**
   it is flagged "below minimum" and can be written off with Admin approval.
3. **Given** a cut product, **When** its item view opens, **Then** it lists every piece with
   length, condition and location, and the total length.

---

### User Story 5 - Item view answers "where is it and what happened to it" (Priority: P2)

Anyone allowed to see stock opens an item and sees name, code(s), description, unit, photos,
stock by condition and location, the last event it was used in, upcoming reservations, its
damage summary (total damaged to date, currently damaged, written off, events where damage
happened, with photos while kept), and its full ledger history.

**Independent Test**: For an item with history from at least one event, open the item view on
web and phone and compare every figure with the ledger.

**Acceptance Scenarios**:

1. **Given** an item last dispatched to event `EVT-2026-0012`, **When** its view opens, **Then**
   "Last used in" shows that event's number, name and dates.
2. **Given** damage reports older than 6 months, **When** the damage summary is shown, **Then**
   their quantities and decisions are listed but their photos are no longer available (owner
   decision Q12).

---

### User Story 6 - Damaged stock is written off or put back (Priority: P2)

Damaged stock is either written off (needs Admin approval) or, if it turns out usable, returned
to Available with a reason. A full repair workflow is a later phase (owner decision Q14).

**Acceptance Scenarios**:

1. **Given** 5 damaged chairs, **When** a Store Manager requests write-off of 3, **Then** an Admin
   must approve before they move to Written off; the other 2 stay Damaged.
2. **Given** damaged stock found usable, **When** a Store Manager or Admin returns it to Available
   with a reason, **Then** a ledger entry records it.

---

### User Story 7 - Find items and spot low stock (Priority: P3)

Users search and filter items by name, code (current or former), category, warehouse, condition
and "below minimum stock". Admins get an alert when available stock falls below an item's
minimum level.

**Acceptance Scenarios**:

1. **Given** 10,000 items, **When** a user types part of a name or code, **Then** results appear
   within 1 second.
2. **Given** an item with minimum 20 and available falling from 21 to 19, **When** the movement is
   recorded, **Then** Admins receive one low-stock alert (not repeated until stock recovers to ≥ 20
   and falls again).

### Edge Cases

- Two users record movements on the same item and location at the same moment: both are
  applied in order; the second is refused if it would make stock negative.
- An item's tracking type cannot change once it has any ledger entry.
- A unit of measure in use cannot be deleted; it can be archived.
- Measured items allow up to 3 decimal places; counted items only whole numbers.
- Photos larger than 10 MB are refused; the phone compresses before upload (longest side
  1600 px).
- Import files: `.xlsx` and `.csv`, up to 5,000 rows; unknown categories in the file can be
  created during import only if the importer ticks "create missing categories".
- Consumables (tape, nails, fresh flowers) are not tracked (owner decision Q7); the catalogue has
  no consumable type.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (INV-01): Admins MUST manage categories in two levels (category → sub-category),
  with archive instead of delete when in use.
- **FR-002** (INV-02): Admins MUST manage units of measure (code, name, family, conversion factor
  to the family's base unit); conversions apply only within a family.
- **FR-003** (INV-03): Admins MUST manage items with: name, code (auto `ITM-NNNNN` or typed;
  editable at any time; unique across all current and former codes), category, description,
  tracking type (counted / measured / cut product), unit (none for counted; required otherwise),
  up to 5 photos, replacement value (₹), minimum stock level, minimum usable length (cut products),
  notes, status (active / archived).
- **FR-004** (INV-04): Opening stock MUST be enterable per warehouse location and condition, singly
  or by Excel/CSV import with a dry-run preview and row-level errors.
- **FR-005** (INV-05): Every stock change MUST be an append-only ledger entry with type, item or
  piece, quantity, from/to location and condition, reason, actor, time and reference. Displayed
  quantities MUST be derived from the ledger.
- **FR-006** (INV-06): Cut products MUST be tracked per piece (piece number, original length,
  current length, location, condition); a cut MUST create the cut piece and keep the offcut in
  stock; pieces below minimum usable length MAY be written off.
- **FR-007** (INV-07): The item view MUST show the information listed in User Story 5.
- **FR-008** (INV-08): The item view MUST show the damage summary in User Story 5.
- **FR-009** (INV-09): Damaged stock MUST be writable off (Admin approval) or returnable to
  Available with a reason; repair workflow is out of scope.
- **FR-010** (INV-10): Item search and filters MUST cover name, current and former codes,
  category, warehouse, condition and below-minimum.
- **FR-011** (INV-11): Admins MUST be alerted once each time an item's available stock crosses
  below its minimum level.
- **FR-012**: The platform MUST provide the reserve/release and move operations that 005–007 use:
  reserve available stock for an event, release it, and move between conditions/locations — all as
  ledger entries.
- **FR-013**: Item photos MUST be kept for as long as the item exists (owner decision Q12).
- **FR-014**: Event Managers MUST have view-only access to the catalogue and stock; Store
  Managers see and act on stock only in their assigned warehouses (permission matrix, 002).

### Key Entities

- **Category**: name, parent (optional), status.
- **Unit of measure**: code, name, family, factor to base unit, status.
- **Item**: code, former codes, name, description, category, tracking type, unit, photos,
  replacement value, minimum stock, minimum usable length, status.
- **Item piece** (cut products): piece number, original length, current length, location,
  condition, parent piece (for offcuts).
- **Stock movement (ledger entry)**: type, item/piece, quantity, from location and condition,
  to location and condition, reason, actor, time, reference (event, count, transfer, import,
  correction of another entry).
- **Stock balance**: item × location × condition → quantity; derived from the ledger and
  rebuildable.
- **Import batch**: file, uploaded by, preview result, confirmed time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening stock for 2,000 items can be imported in under 10 minutes including review
  of the dry-run preview.
- **SC-002**: For 100% of items, every displayed quantity equals the sum of its ledger entries
  (verified by a rebuild check).
- **SC-003**: The item view opens in under 2 seconds on a mid-range phone on 4G.
- **SC-004**: Search returns results in under 1 second with 10,000 items.
- **SC-005**: Zero ledger entries can be modified or deleted through any screen or API call.
- **SC-006**: A cut recorded on a phone at the warehouse takes under 30 seconds.

## Assumptions

- Until 004 ships, each warehouse has one default location; 004 adds user-defined locations and
  moves default-location stock into them by ledger movements.
- Replacement value is per unit (per piece, per metre, per kg) in ₹ and is used for damage and
  variance values in 006, 007 and 009.
- "Reserved" quantities are created by event planning (005); this feature only provides the
  operations.
- Barcode/QR labels are Phase 2 (owner decision Q6).
