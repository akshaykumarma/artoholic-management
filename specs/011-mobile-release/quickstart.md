# Quickstart & Validation: 011-mobile-release

Prerequisites: 001–010; Artoholic Play Console and Apple Developer accounts (PRD D2); Expo
account with the project linked. Runbook: `docs/runbooks/mobile-release.md`.

```bash
npx eas build --profile preview --platform all
```

```bash
npx eas submit --profile preview --platform all
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Install preview build from Play internal testing and TestFlight | Runs on Android 9 and iOS 15 devices | US1, US2 |
| 2 | Complete the release checklist for both platforms | Recorded with build numbers | US2, SC-002 |
| 3 | Raise iOS minimum while iOS build is `in_review` | `VERSION_NOT_LIVE` | US3-2 |
| 4 | Production build receives a damage-report push | ≤ 30 s | US4 |
| 5 | Request account deletion; Admin completes | Name/phone/email pseudonymised everywhere; history attributed | US5, SC-004 |
| 6 | Deny location and camera | Checklist works; photo from library still possible | FR-008 |
