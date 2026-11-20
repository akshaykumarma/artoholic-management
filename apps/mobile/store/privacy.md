# Privacy declarations — 011 R4 (review every release)

Answers for Apple's App Privacy and Google Play's Data safety form. They must match `/privacy` on the web app.

| Data | Collected | Linked to the user | Purpose | Optional |
|------|-----------|--------------------|---------|----------|
| Name, phone, email | Yes | Yes | App functionality (account, sign-in, notifications, reset codes) | No |
| Photos | Yes | Yes | App functionality (item and damage photos) | Yes (only when taking a photo) |
| Precise location | Only when a checklist step is submitted and the user allowed it (not requested by the current app build) | Yes | App functionality | Yes |
| Device push token | Yes | Yes | App functionality (notifications) | Yes |
| App activity (actions in the app) | Yes | Yes | App functionality, accountability (audit log) | No |
| Diagnostics (app version, platform) | Yes | Yes | App functionality (update checks) | No |

- No tracking, no advertising, no data sold or shared with third parties except processors (hosting, storage,
  WhatsApp and email delivery, Expo push).
- Data encrypted in transit (HTTPS).
- **Account deletion**: in the app under Request account deletion. It is completed within 30 days by pseudonymisation;
  records of past work are kept for stock accountability (DPDP Act; constitution V).
