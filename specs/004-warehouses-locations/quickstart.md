# Quickstart & Validation: 004-warehouses-locations

Prerequisites: 001–003. Contract: [contracts/api-warehouses.md](contracts/api-warehouses.md).

```bash
npm test -- --filter=warehouses --filter=transfers
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Create `MAIN` with levels Aisle → Row → Box and two Store Managers | Both see Main; another SM does not | US1 |
| 2 | Bulk A × 1–3 × 1–2 | 6 bins `MAIN-A-01-01`…`MAIN-A-03-02` | US2, SC-001 |
| 3 | Bulk A × 1–10 | Rows `01`…`10` | US2-2 |
| 4 | Move stock from default location into bins; deactivate default | Allowed only when empty | US3-3 |
| 5 | Try to deactivate a bin holding damaged stock | `LOCATION_NOT_EMPTY` | US5 |
| 6 | Transfer 20 chairs MAIN → NORTH; dispatch; receive 19 | 20 in transit (not available); 1 shortfall pending Admin | US4, SC-004 |
