# Implementation Plan: Mobile App Store Release

**Branch**: `011-mobile-release` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-mobile-release/spec.md`

## Summary

Productionise the Expo app: EAS build profiles (development, preview/internal, production),
versioning (`version` semver + auto-incremented build numbers), store listings under
Artoholic's accounts, production push credentials (FCM v1 key, APNs key) registered with Expo,
privacy declarations and a public privacy-policy page, just-in-time permission prompts, an
in-app "Request account deletion" flow with Admin completion and pseudonymisation, and a
recorded release checklist that gates promotion and raising the minimum version (001).
Decisions: [research.md](research.md).

## Technical Context

**Language/Version / Platform / Project Type**: As 001

**Primary Dependencies**: EAS Build and EAS Submit; `expo-updates` disabled for native-binary
gating (JS-only updates not used in MVP); `expo-notifications`; GitHub Actions for build
triggers

**Storage**: PostgreSQL — `app_releases`, `release_checks`, `account_deletion_requests`

**Testing**: Vitest — pseudonymisation touches every personal-data column and keeps FK
attribution; release-gate rule (minimum version raise refused unless the release is `live` on
that platform); jest-expo permission-flow tests; manual release checklist on real devices

**Performance Goals**: Cold start ≤ 3 s on a mid-range Android; app size ≤ 50 MB download

**Constraints**: Publisher = Artoholic (Q11); privacy forms must match collected data; iOS
minimum not raised until iOS build is live

**Scale/Scope**: 2 store listings; ≈ monthly releases

## Constitution Check

| Principle / section | How this plan complies | Status |
| --- | --- | --- |
| I. Test-First | Pseudonymisation and release-gate rules tested first. | Pass |
| II. Ledger | Pseudonymisation never alters movements; only person fields. | Pass |
| III. One API contract | Minimum-version raise is the 001 mechanism, now gated by release status. | Pass |
| IV. Field-first mobile | Just-in-time permissions; app works without location; library fallback without camera. | Pass |
| V. Security & privacy | DPDP-compliant deletion requests; accurate store declarations; production secrets in EAS, not the repo. | Pass |
| VI. Simplicity | EAS services instead of self-managed build machines. | Pass |

**Post-design re-check**: Pass.

## Project Structure

```text
specs/011-mobile-release/ (plan, research, data-model, quickstart, contracts/api-release.md)

apps/mobile/{app.config.ts,eas.json}        # profiles, bundle ids, permissions strings
apps/mobile/app/(shell)/settings/delete-account.tsx
apps/mobile/store/                           # listing text, screenshots, privacy answers (source of truth)
apps/web/app/privacy/page.tsx                # public privacy policy
apps/web/server/{releases,deletion-requests}/
apps/web/app/api/v1/{admin/releases,me/deletion-request,admin/deletion-requests}/…
.github/workflows/mobile-release.yml         # build on tag, submit to internal tracks
docs/runbooks/mobile-release.md              # release checklist
```

## Complexity Tracking

No violations.
