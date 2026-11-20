/* eslint-disable react/jsx-no-literals -- the policy is legal text published as written, in English (Q9). */
import { getCompanyProfile } from '@/server/admin/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Privacy policy · Artoholic' };

/** Public privacy policy (011 FR-006); store listings link here. Keep in step with apps/mobile/store/privacy.md. */
export default async function PrivacyPage() {
  const c = await getCompanyProfile();
  return (
    <main className="main" style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}>
      <h1>Privacy policy</h1>
      <p>{c.name} (“we”) runs the Artoholic web and mobile apps for its own staff to manage inventory, warehouses and events. The apps are not offered to the public.</p>
      <h2>What we collect and why</h2>
      <ul>
        <li><strong>Account details</strong> — your name, phone number, email and role, to sign you in, send you work notifications and password-reset codes.</li>
        <li><strong>Photos</strong> — photos you take of items and damage, to record stock and damage. Item photos are kept indefinitely; damage photos are deleted 6 months after the damage report is decided.</li>
        <li><strong>Location</strong> — when you allow it, the location at the moment you submit a checklist step, to show where items were handed over. The apps work if you refuse.</li>
        <li><strong>Device push token</strong> — to send notifications to your phone; removed when you sign out.</li>
        <li><strong>Activity records</strong> — what you did and when (for example a dispatch or an approval), app version and network address, kept for at least 3 years for accountability.</li>
        <li><strong>Messages</strong> — the text of WhatsApp and email messages the apps send you is kept as a permanent record; one-time codes are never stored in readable form.</li>
      </ul>
      <p>We do not use your data for advertising, do not track you across other apps or websites, and do not sell or share it with third parties, other than the service providers that deliver messages, push notifications, storage and hosting for us.</p>
      <h2>Your rights</h2>
      <p>You can ask for your account to be deleted from the app (Settings → Request account deletion). Within 30 days we deactivate the account and replace your name, phone number and email with a pseudonym; records of past work remain, attributed to the pseudonym, as required for stock accountability. You can also ask us for a copy or correction of your details.</p>
      <h2>Contact</h2>
      <p>{[c.name, c.address, c.email, c.phone].filter(Boolean).join(' · ')}</p>
    </main>
  );
}
