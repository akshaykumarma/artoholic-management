# Validation record: 011 Mobile Release

**Date**: 2026-11-20 · **Branch**: `011-implementation`

## Done in code and verified

| Story | Scenario | Result | Evidence |
|-------|----------|--------|----------|
| US2 | Releases recorded per platform; MAJOR.MINOR.PATCH; build numbers always increase; versions never go backwards; release notes required | Pass | `tests/integration/releases.test.ts` |
| US2-1 | A build can't be marked live until all 8 checks are ticked (with tester and device); a rejection needs its reason | Pass | `releases.test.ts`; Admin console → App releases |
| US3 | Minimum version raised only to a version live on that store; iOS stays put while Apple is still reviewing | Pass: `VERSION_NOT_LIVE` | `releases.test.ts` |
| US5-1 | In-app deletion request: Admins told, the user sees the 30-day date; requesting again returns the open request; audited | Pass | `releases.test.ts`; mobile `permissions.test.tsx` |
| US5-2 | Completing a request: name becomes "Former user #…", phone, email and username cleared, deactivated, sessions and push tokens removed; past audit entries stay attributed to the pseudonym | Pass | `releases.test.ts` |
| FR-006 | Public privacy policy at `/privacy`; store privacy answers in `apps/mobile/store/privacy.md` | Pass | e2e `privacy.spec.ts` |
| FR-008 | Camera asked only when taking a photo, explained first; gallery offered if refused. Notifications explained before the system prompt. Location not requested by this build | Pass | mobile `permissions.test.tsx` |
| R1 | EAS `production` profile (remote versions, auto-increment); tag `mobile-v*` builds and submits to the internal tracks | Configured | `apps/mobile/eas.json`, `.github/workflows/mobile-release.yml` |

## Waiting on the owner (Artoholic's accounts and real phones)

- **T001** Confirm the app name "Artoholic" and the id `in.artoholic.ops`.
- **T003** Create the Play and Apple developer accounts; upload the FCM v1 key and the APNs .p8 to Expo; set `EAS_PROJECT_ID`,
  `EAS_ENABLED`, `EXPO_TOKEN` and the production API URL.
- **T006 / T012 / T016** Build with `git tag mobile-v0.1.0`, install from internal testing on an Android 9 phone and an iOS 15
  iPhone, run the 8-point checklist (including push ≤ 30 s), record it in Admin console → App releases, then publish.

Steps for all of these are in `docs/runbooks/mobile-release.md`.

## Checks

- Shared 67/67, web integration and contract 280/280, mobile 36/36, Playwright e2e 16/16.
- Typecheck and lint clean (exit code 0).

## Note for the owner

Pseudonymisation changes the person's details everywhere they are shown, because every screen reads the name through the user id.
Two permanent records are not rewritten:
- the WhatsApp/email message log keeps the phone number or email a message was sent to (owner decision: the message log is permanent);
- audit entries keep the before/after values captured at the time (the audit log is append-only).

Confirm this matches the DPDP position you want, or decide whether those two records should be masked too.
