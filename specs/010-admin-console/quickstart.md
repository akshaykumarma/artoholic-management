# Quickstart & Validation: 010-admin-console

Prerequisites: 001–009. Contract: [contracts/api-admin.md](contracts/api-admin.md).
Restore runbook: `docs/runbooks/restore.md` (written in this feature).

```bash
npm test -- --filter=admin --filter=retention --filter=backup
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Edit an item's value; search audit by item | One entry old → new; exportable | US1 |
| 2 | As Admin open audit log | View/export only | US1-3 |
| 3 | End one of a user's two sessions | That device signed out only | US2 |
| 4 | Run backup job with backup bucket unreachable | Failure alert ≤ 15 min | US5, SC-002 |
| 5 | Seed a damage report decided 6 months ago on a closed event; run retention | Photos removed; report intact | US6-1 |
| 6 | Seed 4-year-old movements; run roll-up | Balances identical before/after | US6-2, SC-004 |
| 7 | Perform restore test per runbook; record it | RPO ≤ 24 h, RTO ≤ 4 h recorded | SC-003 |
