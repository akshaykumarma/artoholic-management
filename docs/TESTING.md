# Testing on your computer

Set it up with the steps in the README ("Run it locally"), including `npm run seed:demo`. Then sign in at
http://localhost:3000 as the person each step names.

| Who | Username | Password |
|-----|----------|----------|
| Super Admin | the one you created with `seed:super-admin` | your choice |
| Admin | `asha` | `artoholic-demo-2026` |
| Event Manager | `meera` | `artoholic-demo-2026` |
| Store Manager | `ravi` | `artoholic-demo-2026` |

Tip: use a different browser (or a private window) per person, so you can stay signed in as several at once.

## The demo event, start to finish (about 20 minutes)
1. **Asha** opens Events → *Sharma–Verma Wedding Reception*. Check the 150 chairs, 20 tables, 40 light strings and 60 m of drape are reserved.
2. **Ravi** opens Event checklists → *Warehouse dispatch · MAIN*.
   - Enter what goes out; try dispatching fewer chairs (a reason is required), and add a vehicle number.
   - Submit.
3. **Meera** opens the *Site receipt*. Enter 2 chairs damaged with a photo and a note, and leave 1 missing. Confirm and submit.
4. **Asha** opens Event checklists → the two damage reports. Approve one and reject the other.
5. **Meera** re-checks the rejected line, then does the *Return dispatch*. Mark some drape as consumed.
6. **Ravi** does the *Warehouse receipt*, choosing bins.
7. **Asha** opens the event:
   - The reconciliation table shows each line accounted for.
   - Approve any remaining reports, then **Close event**.
   - Look at **Activity** for the full history.

## Other things to try
- **Over-booking:** as Asha, create a second event on the same dates needing 100 chairs from MAIN. You'll see the warning and the notification.
- **Physical count:** as Asha, open Physical counts and start a count for MAIN with Ravi. As Ravi, count, then submit. As Asha, review the variances.
- **Reports:** run R1 *Stock on hand* and download the Excel file. The Admin dashboard is on the home page.
- **Notifications:** the bell count and the Notifications page. Password reset: on the sign-in page use *Forgot password*, then read the code at http://localhost:3000/dev/outbox.
- **Phone:** the same steps work in the Expo Go app (see the README). Photos use the phone camera.

## What you won't see locally
- **WhatsApp and push:** WhatsApp messages, push notifications and emails are *mock* until the real accounts are set up. You can read what would have been sent at `/dev/outbox`. The real message log is under Admin console → Message log.
- **Email to Mailpit:** to send real email into Mailpit (http://localhost:8025), sign in as the Super Admin and set Admin console → WhatsApp and email → SMTP host `localhost`, port `1025`, from `ops@artoholic.test`.

Note anything that looks wrong, with the screen, who you were signed in as, and what you expected.
