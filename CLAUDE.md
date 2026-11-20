# Working agreement for Claude

## Delivering changes

- The default branch is `main`; the running app is deployed from it.
- When a change is finished and its checks pass (typecheck, lint, tests), push the work
  branch, open a pull request into the default branch, and **merge it without asking
  for confirmation** — the repository owner has pre-approved this. Then tell the owner
  it's merged and remind them to redeploy.
- Still ask first before merging if checks are failing, the PR has a merge conflict,
  or a reviewer has requested changes.
- Design previews: when the owner asks to "show it before implementing", share the
  preview and wait for approval before building it.

## How work is specified

- Requirements live in `docs/PRD-v1.1-source.md`; governance in
  `.specify/memory/constitution.md`. Features are built with Spec-Kit in the order of
  PRD §14.2 (`001-overview` … `011-mobile-release`).

## Owner decisions to keep

- **The WhatsApp message log is permanent**: every WhatsApp and email message's full
  text stays in each event's Activity and in Super Admin → Login & activity. OTP codes
  are always shown redacted there.
- Owner decisions Q1–Q14 (PRD §13) are settled; don't reopen them without the owner.
- **Checklists are one entry per step for the whole event** (owner, 2026-11-20): one submission per
  step (per warehouse for warehouse steps), with one set of vehicle and driver details; trucks and
  truckloads are not tracked.
