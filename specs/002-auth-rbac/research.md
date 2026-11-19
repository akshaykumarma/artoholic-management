# Research: 002-auth-rbac

## R1. Sign-in identifier resolution
- **Decision**: Normalise the typed identifier: if it contains `@` → email (lower-case); if it
  parses as a phone number (default region IN) → E.164; else → username (case-insensitive). Look
  up one column. Uniqueness is enforced across all three by a single `user_identifiers` view
  check at write time (a username may not equal any user's email or phone).
- **Rationale**: Guarantees at most one match (spec edge case) with one indexed lookup.
- **Alternatives**: Try all three columns with OR (ambiguous if collisions ever slipped in).

## R2. Phone normalisation
- **Decision**: `libphonenumber-js` (min metadata) in `packages/shared`, default region `IN`;
  `09876543210`, `98765 43210`, `+91-98765-43210` → `+919876543210`. Each account has its own
  number (clarification).
- **Alternatives**: Regex (fails on edge formats, other countries).

## R3. Password reset codes
- **Decision**: 6-digit code from a CSPRNG, stored as HMAC-SHA256 with a server secret; table
  row per request with `attempts`, `expires_at` (10 min), `used_at`. Rate: 3 requests per account
  per rolling hour, plus 10 per network address per hour. Successful reset revokes all sessions.
  Messages go through 008's provider interface (`NotificationChannel`), with a dev mock until 008
  ships; the rendered text is logged with the code replaced by `••••••`.
- **Alternatives**: Magic links (bad on shared phones, WhatsApp link previews can consume them).

## R4. Temporary passwords
- **Decision**: `users.must_change_password` flag; while set, every API call except
  `change-password`, `sign-out` and `me` returns `403 PASSWORD_CHANGE_REQUIRED`.

## R5. Deactivation and revocation
- **Decision**: Deactivation sets `status=deactivated` and `UPDATE sessions SET revoked_at=now()`
  in the same transaction; push tokens are removed (008). Because 001 re-reads user status per
  request, phones are refused on their next call (SC-003).

## R6. Biometric unlock
- **Decision**: `expo-local-authentication`; the session token stays in SecureStore with
  `requireAuthentication` off, and the app gates rendering behind a biometric prompt when it
  returns after > 5 min in background. 3 failures → sign-in screen (token kept but unusable until
  password re-entry, which issues a new session and revokes the old).
- **Alternatives**: SecureStore `requireAuthentication: true` (Android Keystore invalidates keys
  on new fingerprint enrolment, silently logging users out).

## R7. Permission matrix as code
- **Decision**: `Permission` string union and `ROLE_PERMISSIONS` table in
  `packages/shared/src/auth/permissions.ts`, mirroring the spec table; scope ("A" cells) enforced
  by `requireWarehouseScope(user, warehouseId)` and `requireEventAssignment(user, eventId)` helpers
  (event helper implemented in 005). A generated test iterates every role × permission.

## R8. Last-Admin and Admin-only-by-Super-Admin guards
- **Decision**: Enforced in the service layer within a `SERIALIZABLE` transaction that counts
  active Admins after the change; refusal codes `LAST_ADMIN`, `SELF_DEACTIVATION`,
  `SUPER_ADMIN_ONLY`.
