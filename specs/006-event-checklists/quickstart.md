# Quickstart & Validation: 006-event-checklists

Prerequisites: 001–005. Contract: [contracts/api-checklists.md](contracts/api-checklists.md).

```bash
npm test -- --filter=checklists --filter=damage
```

```bash
npm run test:e2e -- tests/e2e/event-lifecycle
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Dispatch 50 chairs, 20 lights, 12 m carpet piece with vehicle details | Reserved → out; In transit; EM notified | US1 |
| 2 | Dispatch 45 of 50 without reason | Refused; with reason → Admins notified | FR-002 |
| 3 | Kill the app mid-entry; reopen | All entries restored | SC-005 |
| 4 | Site receipt 48 good + 2 damaged with photos | `DMG-2026-00001` pending; At site | US2 |
| 5 | Two Admins approve the same report | One succeeds; other `ALREADY_DECIDED` | US3-3 |
| 6 | Return 46, consume 3 m carpet, hand 20 lights to event Y | Returning; Y's EM records receipt | US4, handover |
| 7 | Warehouse receipt 45 of 46 | 45 available; 1 missing report; Reconciling | US5 |
| 8 | Close with a pending report | `NOT_RECONCILED` listing it; after decision → Closed | US6 |
| 9 | Correct a closed event's returned 50 → 49 | −1 correction movement; activity shows old/new | US7 |
| 10 | Open a 200-line checklist on a mid-range Android | ≤ 2 s | SC-006 |
