# Quickstart & Validation: 003-catalogue-inventory

Prerequisites: 001 and 002 running. Contract: [contracts/api-catalogue-stock.md](contracts/api-catalogue-stock.md).

```bash
npm test -- --filter=catalogue --filter=stock --filter=imports
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Create Furniture → Chairs, counted chair (no unit), rope in m, carpet (cut, m) | Units enforced per type | US1 |
| 2 | Change chair code to `CHR-WHITE-01`; search `ITM-00001` | Chair found; old code unusable for new items | US1-3 |
| 3 | Import the opening-stock template with one bad row | Dry run lists row error; commit blocked until fixed | US2 |
| 4 | As Store Manager request −3 chairs correction | Stock unchanged; Admin approves → −3 entry with requester & approver | US3, clarification |
| 5 | Two parallel −30 moves on a bin with 40 | One succeeds, one `INSUFFICIENT_STOCK` | Edge |
| 6 | Cut 12 m from a 30 m roll | Pieces 18 m + 12 m; item total 30 m | US4 |
| 7 | Run balance rebuild check | Zero mismatches | SC-002 |
| 8 | Drop available of an item below its minimum | One low-stock notification | US7 |
