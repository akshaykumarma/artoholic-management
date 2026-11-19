<!--
Sync Impact Report
- Version change: (none) → 1.0.0 (initial ratification for the new Artoholic repository)
- Modified principles: N/A (first version). Structure and governance carried over from the
  Service Management constitution v1.1.0, adapted to the Artoholic domain.
- Added principles:
  - I. Test-First (NON-NEGOTIABLE)
  - II. The Ledger Is the Source of Truth
  - III. One API Contract for Three Apps
  - IV. Field-First Mobile Experience
  - V. Security, Privacy & Audit by Default
  - VI. Simplicity & YAGNI
- Added sections:
  - Technology & Domain Constraints (stack confirmed by the owner, unlike Service Management
    where it was deferred to /speckit-plan)
  - Non-Functional Service Levels (from PRD/BRD v1.1 §10, NFR-01 to NFR-15)
  - Development Workflow & Quality Gates
  - Governance
- Removed sections: N/A
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed (its Constitution Check gates are
    derived from this file at plan time)
  - .specify/templates/spec-template.md ✅ no changes needed
  - .specify/templates/tasks-template.md ✅ no changes needed
  - .specify/templates/checklist-template.md ✅ no changes needed
- Follow-up TODOs:
  - None. The PRD/BRD v1.1 this constitution cites is saved as `docs/PRD-v1.1-source.md`.
-->

# Artoholic Event Operations Platform Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)
Every change to stock movement, event status transitions, checklist submission, damage
approval, physical-count variance posting, or role/permission checks MUST have automated tests
written and reviewed before implementation begins. Tests MUST fail first (red), then the
implementation MUST make them pass (green), followed by refactoring with tests kept green. No
pull request that adds or changes this behavior may merge without tests demonstrating it.
Reconciliation rules (returned + damaged + lost + consumed = dispatched) and over-booking
detection across overlapping event date windows MUST have explicit boundary-case tests.

Rationale: The platform is the system of record for every physical item Artoholic owns. A
silent regression in a quantity rule corrupts stock that people then load onto trucks; writing
the test first forces the expected arithmetic to be stated before code exists.

### II. The Ledger Is the Source of Truth
Stock MUST change only through append-only movement entries (receipt, dispatch, return,
adjustment, damage, write-off, cut, transfer, correction). Every entry MUST record the item or
piece, quantity, from/to location and condition, reason, actor, timestamp, and the referenced
event, count, or transfer. Displayed quantities MUST be derived from the ledger (cached
balances are allowed but MUST be rebuildable from it). Past entries MUST NOT be edited or
deleted; a correction — including an Admin edit to a closed event — MUST be a new entry that
references what it corrects and carries a reason.

Rationale: The owner's core requirements — item history, damage accountability, scheduled
physical counts, and editing closed events — are only trustworthy if every quantity can be
traced back to who moved it, when, and why.

### III. One API Contract for Three Apps
The web app, the Android app, and the iOS app MUST consume the same versioned API; no surface
may read or write the database by a private path. Every endpoint's request/response shape,
status codes, and error format MUST be defined (shared TypeScript types and schemas) and
reviewed before implementation, with contract tests that fail against the old contract and pass
against the new one. A breaking change MUST ship as a new API version, and the server MUST keep
serving the previous version until the minimum supported mobile app version no longer needs it
(enforced by the forced-update check).

Rationale: Mobile apps installed on staff phones cannot be updated instantly. A contract broken
without a version bump strands managers at an event site with an app that fails mid-checklist.

### IV. Field-First Mobile Experience
Every on-site and warehouse flow (dispatch, site receipt, return dispatch, warehouse receipt,
damage report, physical count) MUST be usable one-handed on a mid-range Android phone, with tap
targets of at least 44 × 44 pt. Entered checklist data MUST be saved on the device as a draft
before upload, and a failed photo or network upload MUST NOT lose any entered data. Photos MUST
be compressed on the device (longest side ≤ 1600 px) before upload.

Rationale: Event and store managers work at venues with weak signal and little time. If the
app loses their work once, they go back to phone calls and the reconciliation chain breaks.

### V. Security, Privacy & Audit by Default
All input crossing a trust boundary MUST be validated, and every API call MUST be authorized on
the server against the caller's roles and assignments (a Store Manager acts only on assigned
warehouses; an Event Manager only on assigned events). Every create, update, delete, approval,
sign-in, and failed sign-in MUST produce an audit entry with actor, timestamp, device or IP,
and before/after values. Secrets MUST NOT be committed to the repository.

The following are NON-NEGOTIABLE minimums:

- All data in transit MUST use TLS 1.2 or higher.
- Passwords MUST be hashed with bcrypt (cost ≥ 12) or argon2id; plaintext or reversible
  storage is prohibited.
- Web session cookies MUST be HttpOnly and Secure, and every state-changing web endpoint MUST
  be CSRF-protected. Mobile tokens MUST be stored in the Android Keystore / iOS Keychain.
- Sign-in MUST be throttled after 5 failed attempts.
- New endpoints and screens MUST be reviewed against the OWASP Top 10 (web and mobile) before
  shipping.
- Personal data handling MUST comply with India's Digital Personal Data Protection Act 2023;
  deleting a person's data MUST pseudonymise them rather than break the audit trail.
- The WhatsApp and email message log is permanent: every message's full text stays visible in
  the related event's activity and in the Super Admin console. One-time codes MUST always be
  shown redacted.

Rationale: The platform records losses and approvals that carry money and blame. Gaps in
authorization or in the audit trail directly undermine that accountability.

### VI. Simplicity & YAGNI
Start with the simplest design that satisfies the current specification. Do not introduce
multi-tenancy, a generic workflow engine, configurable state machines, plugin systems, or
offline sync infrastructure until a ratified spec requires them. Every added layer of
indirection MUST be justified in the plan's Complexity Tracking section against a specific,
current requirement.

Rationale: One developer is building three surfaces. Unjustified flexibility multiplies the
code that tests, security review, and app-store releases must cover.

## Technology & Domain Constraints

The owner confirmed the stack on 2026-11-19 (PRD/BRD v1.1, decision Q10). It is binding unless
amended here:

- **Backend and web**: the same stack as the Service Management tool — Next.js (TypeScript),
  PostgreSQL with Drizzle ORM and migrations, pg-boss for background and scheduled jobs,
  S3-compatible object storage for photos and reports, exceljs for Excel output, Docker-based
  deployment.
- **Mobile**: one React Native app (Expo recommended) built for Android and iOS, sharing API
  types with the backend.
- **Repository**: a new repository, separate from Service Management.

Domain constraints, regardless of implementation detail:

- Event status MUST be an explicit, enumerable state machine (Draft → Scheduled → Dispatching
  → In transit → At site → Returning → Reconciling → Closed, plus Cancelled before dispatch);
  no free-form status strings.
- An event MUST NOT be closed until every line is reconciled and every damage or loss report
  has an Admin decision. Any Admin may approve.
- Over-booking is allowed but MUST raise a warning to the event's Admin, Event Manager(s), and
  Store Manager(s), naming the short items and clashing events.
- Cut products MUST be tracked per roll or piece with current length; offcuts return to stock.
- Times MUST be stored in UTC and shown in IST (Asia/Kolkata); money in ₹ with Indian digit
  grouping; dates as DD-MM-YYYY.

## Non-Functional Service Levels

These are binding minimums for the MVP, sourced from the ratified PRD/BRD v1.1 §10
(`docs/PRD-v1.1-source.md`). A design that cannot meet one MUST be revised, or the shortfall
explicitly justified in the plan's Complexity Tracking section, before implementation.

- **Performance**: API p95 ≤ 500 ms for reads and ≤ 1 s for writes at 50 concurrent users; web
  pages interactive in ≤ 3 s on 4G; a 200-line checklist opens in ≤ 2 s on a mid-range Android
  phone; a 1600 px photo uploads in ≤ 5 s on 4G, with automatic retry.
- **Scale (3-year horizon)**: 50 users, 10 warehouses, 20,000 locations, 10,000 items, 1,000
  events a year, 500,000 ledger entries, 500 GB of photos.
- **Availability**: 99.5% monthly uptime, excluding maintenance announced 24 h ahead and done
  between 23:00 and 06:00 IST.
- **Backup & recovery**: daily backups kept 30 days; recovery point ≤ 24 h, recovery time
  ≤ 4 h; a restore tested every quarter.
- **Data retention**: item photos and damage records are kept forever; damage photos are
  deleted after 6 months; events, the stock ledger, and the audit log are kept for at least 3
  years (purging older ledger entries MUST first roll them into an opening-balance snapshot so
  balances stay correct); message logs are permanent with one-time codes redacted.
- **Compatibility**: Android 9 (API 28)+, iOS 15+, the last two versions of Chrome, Edge,
  Safari, and Firefox; web layouts work from 360 px wide; the mobile app runs on phones with
  3 GB RAM.
- **Accessibility**: WCAG 2.1 AA on web; platform accessibility labels on mobile; text scaling
  up to 200% works.
- **Localisation**: English at launch; all UI strings externalised so other languages need no
  code rewrite.
- **Notification latency**: in-app and push ≤ 30 s; WhatsApp and email ≤ 2 min; scheduled
  reports within 15 min of their scheduled time, with up to 3 retries and a failure alert to
  the Super Admin.
- **Observability**: structured logs and error tracking on web, API, and mobile; job failures
  alert the Super Admin.

## Development Workflow & Quality Gates

- Every feature proceeds through the Spec Kit flow: `/speckit-specify` → (optional
  `/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` → (optional `/speckit-analyze`,
  `/speckit-checklist`) → `/speckit-implement`. Features follow the order in PRD/BRD v1.1 §14.2
  (`001-overview` through `011-mobile-release`).
- Every plan MUST include a Constitution Check verifying the design against the six Core
  Principles and the Non-Functional Service Levels; unresolved violations MUST be justified in
  Complexity Tracking or the plan MUST be revised.
- A feature that has mobile screens MUST specify and test them in the same feature as its web
  screens and API; mobile is not deferred to a later "port".
- Pull requests MUST NOT merge with failing typecheck, lint, unit, contract, or end-to-end
  tests, or with unaddressed security findings.
- Code review MUST verify: tests were written before the code they cover; stock changes go
  through the ledger; contracts are defined for any new or changed endpoint; server-side
  authorization and audit entries are present; no unjustified new abstractions.

## Governance

This constitution supersedes any conflicting convention or informal practice in the Artoholic
repository. Amendments are made by editing this file via `/speckit-constitution` and MUST
include an updated Sync Impact Report describing what changed and why. Requirement changes
originate in the PRD/BRD; a change there that alters a principle or service level MUST be
reflected here in the same change.

Versioning policy (semantic versioning applied to governance):
- MAJOR: backward-incompatible removal or redefinition of a principle (e.g., dropping
  Test-First or allowing direct stock edits).
- MINOR: a new principle or section, or materially expanded guidance.
- PATCH: wording clarifications, typo fixes, non-semantic refinements.

Compliance review: every `/speckit-plan` Constitution Check and every pull request review MUST
verify compliance with the principles and service levels above. Any exception MUST be documented
with a concrete justification at the point of use (the plan's Complexity Tracking section or the
PR description); "it's simpler this way" without a specific reason is not sufficient.

**Version**: 1.0.0 | **Ratified**: 2026-11-19 | **Last Amended**: 2026-11-19
