# Validation record: 009 Reports & Dashboard

**Date**: 2026-11-19 · **Branch**: `009-implementation`

## Scenarios

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Run "Stock on hand" for MAIN; on-screen values match stock; Excel has the same rows | Pass: all 10 reports run; R1 values = quantity × replacement value; stock at events listed separately | `tests/integration/reports.test.ts`; e2e `stock-reports.spec.ts` |
| 2 | Store Manager / Event Manager scope | Pass: a Store Manager sees only assigned warehouses; Event Managers see only their events; R10 shows managers only themselves | `reports.test.ts` |
| 3 | Excel conventions | Pass: title, filters and "Generated DD-MM-YYYY HH:mm IST" header; money numeric with ₹ format; quantities numeric; dates as real dates (dd-mm-yyyy); empty → "No data for this period" | `reports.test.ts` |
| 4 | Schedule to Admins only; delivery by WhatsApp document and email attachment, logged | Pass: non-Admin → `RECIPIENT_NOT_ADMIN`; managers can't schedule; one run per IST day; WhatsApp `[document]` and email `[attachment]`; deliveries listed on the run | `reports.test.ts` |
| 5 | Monthly on the 31st; weekly on its weekday; a running run makes the next wait; deactivated recipient dropped and owner told | Pass | `reports.test.ts` |
| 6 | Dashboard figures, Admin only, refreshed every 60 s, each linking to its list | Pass | `reports.test.ts`; e2e |
| Perf | 5,000-row report: first page ≤ 5 s, Excel ≤ 30 s | Pass: about 0.8 s together on the CI-sized database | `reports.test.ts` |

Phones: report view and Excel sharing through the share sheet (`expo-sharing`) — mobile `reports.test.tsx`. The Admin
dashboard card is on the phone's home screen.

## Checks

- Shared 67/67, web integration and contract 267/267, mobile 32/32, Playwright e2e 14/14.
- Typecheck and lint clean (exit code 0).

## Notes

- Delivery retries and the Super Admin alert come from 008. Files above 100 MB (WhatsApp) or 20 MB (email) are sent as a
  link to the signed-in download page.
- `STORAGE_DRIVER=memory` is for e2e runs without S3 only; production keeps S3 (report files under `reports/`; set a
  90-day lifecycle rule on that prefix in the bucket).
