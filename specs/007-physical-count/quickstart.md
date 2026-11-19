# Quickstart & Validation: 007-physical-count

Prerequisites: 001–006. Contract: [contracts/api-counts.md](contracts/api-counts.md).

```bash
npm test -- --filter=counts
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Monthly schedule from 31-01-2027 | Due 31-01, 28-02, 31-03 | US1 |
| 2 | Run the 07:00 IST job twice on a due date | One session `CNT-2027-0001` | US2 |
| 3 | Open blind sheet as counter; inspect API response | No recorded quantities | US3-1 |
| 4 | Count with variances −3 and +2; approve −3, reject +2 | −3 adjustment movement; +2 back to recount | US4 |
| 5 | Move 5 chairs after snapshot, then approve that line | Adjustment ignores the later move | US4-2 |
| 6 | Leave session open 3 days past due | Admins notified daily | US5 |
