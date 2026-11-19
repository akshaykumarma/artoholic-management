# Quickstart & Validation: 008-notifications

Prerequisites: 001–007. Dev uses the WhatsApp mock adapter and a local SMTP catcher
(Mailpit in Docker Compose). Contract: [contracts/api-notifications.md](contracts/api-notifications.md).

```bash
docker compose up -d mailpit
```

```bash
npm test -- --filter=notifications
```

| # | Scenario | Expected | Covers |
| --- | --- | --- | --- |
| 1 | Submit site receipt with damage | Every Admin: in-app, push, WhatsApp (mock) ≤ 2 min, link opens report | US1, SC-001 |
| 2 | Same trigger twice in 30 s | One notification per channel | Edge, SC-004 |
| 3 | Quiet hours 22–07, dispatch notice at 23:00 | In-app now; push/WhatsApp at 07:00; damage alert to Admin immediate | US3 |
| 4 | Password reset | Log shows `••••••`; no 6-digit code in DB `messages` | US5, SC-003 |
| 5 | Mock provider fails 4 times | 3 retries, then failed + Super Admin alert | US5-3 |
| 6 | Trigger without template mapping | WhatsApp skipped "no template"; others sent | US4-1 |
| 7 | Open event activity | Full WhatsApp texts with statuses | Owner rule |
