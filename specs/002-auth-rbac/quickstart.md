# Quickstart & Validation: 002-auth-rbac

Prerequisite: 001 running (see [001 quickstart](../001-overview/quickstart.md)). Contracts:
[contracts/api-users-auth.md](contracts/api-users-auth.md).

```bash
npm test -- --filter=auth --filter=users
```

```bash
npm run test:e2e -- tests/e2e/users
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | As Super Admin create Admin "Ravi"; as Ravi create "Priya" (Event + Store Manager) with phone only | Priya's username = `+91…`; both roles shown | US1, FR-002 |
| 2 | Create another user with Priya's phone written as `09876543210` | `IDENTIFIER_TAKEN` on phone | Edge, clarification |
| 3 | Sign in as Priya with `98765 43210` + temp password | Forced change screen; nothing else reachable | US2 |
| 4 | Forgot password for Priya (dev WhatsApp/email mock) | Generic message; same code in both mock outboxes; log shows `••••••` | US3 |
| 5 | Enter 5 wrong codes | Code refused thereafter | US3-3 |
| 6 | Sign Priya in on a phone; deactivate her on web | Phone returns to sign-in on next action within 5 s | US4, SC-003 |
| 7 | Ravi tries to remove his own Admin role while sole Admin | `LAST_ADMIN` | FR-012 |
| 8 | Turn on biometrics on phone; background 6 min; reopen | Biometric prompt before any data | US5 |
| 9 | Run the permission-matrix test suite | One passing test per cell | SC-004 |
