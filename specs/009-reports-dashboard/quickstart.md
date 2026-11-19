# Quickstart & Validation: 009-reports-dashboard

Prerequisites: 001–008. Contract: [contracts/api-reports.md](contracts/api-reports.md).

```bash
npm test -- --filter=reports --filter=dashboard
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Run R1 for MAIN; download xlsx | Same rows on screen and file; ₹ numeric cells | US1 |
| 2 | Run R1 as a Store Manager of NORTH only | Only NORTH rows | US1-2 |
| 3 | Schedule R5 daily 09:00 IST to two Admins | Both get WhatsApp document + email by 09:15 | US2, SC-001 |
| 4 | Try adding an Event Manager as recipient | `RECIPIENT_NOT_ADMIN` | Q13 |
| 5 | Monthly schedule on 31st in February | Runs 28/29 Feb | US2-1 |
| 6 | New damage report | Dashboard pending approvals +1 within 1 min | US3 |
