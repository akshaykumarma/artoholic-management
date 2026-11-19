# Feature Specification: Mobile App Store Release

**Feature Branch**: `011-mobile-release`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "011-mobile-release from docs/PRD-v1.1-source.md §7, §12 (C2, C3, D2, D5) and §14.2: publish the Android and iOS apps to Google Play and the Apple App Store under Artoholic's own developer accounts (owner decision Q11); internal testing via Play internal testing and TestFlight before every release; push notification setup; forced-update process; accurate privacy labels / data-safety forms and privacy policy; in-app account deletion request path (Apple requirement); release checklist and versioning."

## Overview

Features 001–010 build the mobile app and distribute it to testers. This feature takes it to
the public stores so staff install it like any other app, and sets up a repeatable release
process: test builds, store listings, privacy declarations, push credentials, version rules and
the forced-update step. No new business features.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff install the app from the stores (Priority: P1)

A new staff member searches "Artoholic" on Google Play or the App Store (or follows a link from
their welcome message), installs the app published by Artoholic, and signs in.

**Why this priority**: Field staff must get the app without side-loading.

**Independent Test**: On a fresh Android phone and a fresh iPhone, install from the public store
listing and sign in with a test account.

**Acceptance Scenarios**:

1. **Given** the store listings, **When** viewed, **Then** the publisher is Artoholic, with name,
   icon, screenshots, description, support contact and privacy policy link.
2. **Given** an Android 9 phone and an iPhone on iOS 15, **When** installed, **Then** the app runs
   (constitution compatibility levels).

---

### User Story 2 - Every release is tested before staff get it (Priority: P1)

Each release is built, given a new version number, sent to internal testers (Play internal
testing and TestFlight), checked against a release checklist, and only then promoted to the
public stores.

**Acceptance Scenarios**:

1. **Given** a release candidate, **When** it is promoted, **Then** the checklist (sign-in, menu,
   a dispatch, a receipt with photo, a damage approval, a count entry, push received, update
   prompt) has been ticked for both platforms and recorded with the build number.
2. **Given** version numbers, **When** a release is made, **Then** the version follows
   MAJOR.MINOR.PATCH and the build number always increases.

---

### User Story 3 - Old app versions are retired safely (Priority: P1)

When a release changes the API in a way old apps cannot handle, the Super Admin raises the
minimum supported version (001) only after the new version is live in both stores; staff on old
versions see "Update required" with a store link.

**Acceptance Scenarios**:

1. **Given** a new version approved in both stores, **When** the Super Admin raises the minimum,
   **Then** old apps show "Update required" at next launch or foreground.
2. **Given** a new version approved on Android but still in Apple review, **When** the release
   checklist is followed, **Then** the iOS minimum is not raised until the iOS version is live.

---

### User Story 4 - Push notifications work in production (Priority: P1)

Production push credentials are set up for Android (Firebase) and iOS (Apple Push Notification
service) under Artoholic's accounts, and a production build receives the notifications from 008.

**Acceptance Scenarios**:

1. **Given** a production build on each platform, **When** a damage report is created, **Then** an
   Admin's phone receives the push within 30 seconds.

---

### User Story 5 - Privacy declarations and account deletion requests (Priority: P2)

The store privacy labels (Apple) and data-safety form (Google) accurately declare what the app
collects (name, phone, email, photos, approximate location during checklist steps, device
identifiers for push) and why. A public privacy policy page exists. In the app, a signed-in user
can choose "Request account deletion", which notifies Admins; the account is deactivated and
personal details pseudonymised while keeping the audit trail (constitution V, DPDP Act).

**Acceptance Scenarios**:

1. **Given** a user requests deletion, **When** submitted, **Then** Admins are notified, the user
   is told what will happen and within how long (30 days), and the request is audited.
2. **Given** an Admin completes the request, **When** done, **Then** the user's name, phone and
   email are replaced with a pseudonym on every screen, export and log, and past actions remain
   attributed to the pseudonym.

### Edge Cases

- Apple rejects a build: the release checklist records the rejection reason and the fix; the
  minimum version is not changed.
- A store listing must not claim features that are Phase 2 (offline, scanning).
- Location permission is requested only when a checklist step starts, with an explanation; the
  app works if refused.
- Camera and photo permissions are requested only when taking or choosing a photo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (Q11): The apps MUST be published under Artoholic's own Google Play and Apple
  Developer accounts.
- **FR-002**: Every release MUST pass internal testing on both platforms and the recorded release
  checklist before public promotion.
- **FR-003**: Versions MUST follow MAJOR.MINOR.PATCH with an always-increasing build number;
  release notes MUST be written for each.
- **FR-004**: The minimum supported version MUST only be raised after the required version is live
  on that platform's store.
- **FR-005**: Production push credentials MUST be configured for both platforms.
- **FR-006**: Store privacy declarations and the privacy policy MUST match what the app collects.
- **FR-007**: The app MUST offer "Request account deletion"; completion pseudonymises personal
  details without breaking the audit trail.
- **FR-008**: Runtime permissions (camera, photos, location, notifications) MUST be requested only
  when needed, with an explanation, and the app MUST keep working when they are refused (except
  taking photos when camera is refused, where choosing from the library remains).

### Key Entities

- **Release**: platform, version, build number, notes, checklist results, tester sign-off, store
  status (in review, live, rejected), dates.
- **Account deletion request**: user, requested time, status, completed by, completed time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both apps are live in the public stores and installable on the minimum OS versions.
- **SC-002**: 100% of releases have a completed checklist for both platforms before promotion.
- **SC-003**: After a minimum-version raise, 100% of requests from older apps receive "Update
  required".
- **SC-004**: Deletion requests are completed within 30 days.

## Assumptions

- Artoholic provides the company documents needed for developer accounts (Apple requires a D-U-N-S
  number for organisations) — PRD dependency D2.
- Builds are made with Expo's build service (EAS) as decided in 001's plan; store submission may
  be automated later.
- App name and listing text are approved by the owner before the first submission.
