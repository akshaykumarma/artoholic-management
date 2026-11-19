# Research: 011-mobile-release

## R1. Builds and submission
- **Decision**: EAS Build profiles `development` (dev client), `preview` (internal: Play
  internal testing / TestFlight), `production`; EAS Submit to the internal tracks on tag
  `mobile-v*`; promotion to production done in the store consoles after the checklist.
  `appVersionSource: remote` with `autoIncrement` for build numbers.

## R2. Identifiers
- **Decision**: Android package and iOS bundle id `in.artoholic.ops` (final value confirmed by the
  owner before first submission); app name "Artoholic" subject to listing approval.

## R3. Push credentials
- **Decision**: FCM v1 service-account key and APNs auth key (.p8) uploaded to Expo for the
  project; no secrets in the repo.

## R4. Privacy declarations
- **Decision**: Data collected: name, phone, email (account), photos (app functionality), precise
  location only during checklist steps when allowed (app functionality), device push token,
  diagnostics. No tracking, no ads, no third-party sharing. Answers kept in
  `apps/mobile/store/privacy.md` and reviewed every release.

## R5. Account deletion
- **Decision**: In-app request → `account_deletion_requests` (pending) → Admins notified (008)
  → Admin completes within 30 days: deactivate, revoke sessions, replace name with "Former user
  #<short id>", phone/email/username with non-identifying placeholders, delete push tokens.
  Audit and movements keep the user id (now pseudonymised).

## R6. Version retirement gate
- **Decision**: `app_releases.store_status` per platform; 001's mobile-version endpoint refuses
  raising `minimumVersion` above the highest `live` release on that platform
  (`409 VERSION_NOT_LIVE`).
