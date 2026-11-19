# Validation record: 003-catalogue-inventory

**Date**: 2026-11-19

| Suite | Result |
| --- | --- |
| Shared (incl. decimal quantity math) | 49 / 49 |
| Web integration + contract (ledger invariants, parallel debits, catalogue, codes, units, imports, corrections, write-offs, cuts, item view, search, low stock) | 213 / 213 |
| Mobile jest-expo (incl. item view, correction request, photo compression) | 20 / 20 |
| Playwright e2e (incl. category → item → opening stock → correction) | 8 / 8 |

| # | Quickstart scenario | Status |
| --- | --- | --- |
| 1 | Categories, counted chair, rope in m, carpet (cut) | ✅ `catalogue.test.ts`, e2e |
| 2 | Change code; search the old one; old code never reused | ✅ `catalogue.test.ts` |
| 3 | Import with a bad row → dry run lists it; commit blocked | ✅ `imports.test.ts` |
| 4 | Store Manager −3 correction waits for Admin; Admin's own applies at once | ✅ `corrections.test.ts`, e2e |
| 5 | Two parallel −30 on 40 → one refused | ✅ `ledger.test.ts` |
| 6 | Cut 12 m from 30 m → 18 m + 12 m, total 30 m | ✅ `cuts.test.ts` |
| 7 | Balance rebuild check → zero mismatches | ✅ `ledger.test.ts` (nightly job at 03:00 IST) |
| 8 | Low-stock alert once per crossing | ✅ `item-view.test.ts` (outbox; delivered by 008) |

Notes: photos upload straight to S3-compatible storage with presigned URLs (tested with an in-memory store; MinIO is not running in the build environment). Creating items on the phone is not offered; Admins create items on the web.
