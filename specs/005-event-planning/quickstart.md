# Quickstart & Validation: 005-event-planning

Prerequisites: 001–004. Contract: [contracts/api-events.md](contracts/api-events.md).

```bash
npm test -- --filter=events
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Schedule event with 50 chairs from MAIN | `EVT-2026-0001`; 50 reserved; overlapping availability −50 only | US1 |
| 2 | 100 chairs, 80 reserved by overlap; add 30 to new event and save | "20 available — 10 short"; saved with banner; Admins, EMs, SMs notified | US2, Q4 |
| 3 | Reduce clashing event to 60 | Warning clears; same people told | US2-3 |
| 4 | Source event Y's 20 chairs from event X (ends day before) | Line source = X; no new reservation | Clarification |
| 5 | Edit 50 → 40, then cancel | Reservation 40, then 0 | US4 |
| 6 | Two Admins save the same event | Second gets `EVENT_CHANGED` | Edge |
| 7 | Store Manager opens Today | Only today's events for their warehouses | US5 |
| 8 | Run nightly reservation check | Zero mismatches | SC-005 |
