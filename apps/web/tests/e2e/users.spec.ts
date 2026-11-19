import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';

const DB = process.env.DATABASE_URL_E2E ?? 'postgres://artoholic:artoholic@localhost:5432/artoholic_e2e';

async function signIn(page: Page, identifier: string, password: string) {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill(identifier);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function latestCode(to: string): Promise<string> {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query('SELECT body FROM dev_outbox WHERE to_address = $1 ORDER BY id DESC LIMIT 1', [to]);
    return /(\d{6})/.exec(rows[0].body)![1]!;
  } finally {
    await pool.end();
  }
}

test('create user → forced change → reset by code → deactivate (002 quickstart 1, 3, 4, 6)', async ({ page, browser }) => {
  // Owner creates Meena with a phone number only.
  await signIn(page, 'owner', 'e2e-password-123');
  await page.getByRole('link', { name: 'Users & roles' }).click();
  await page.getByRole('link', { name: 'New user' }).click();
  await page.getByLabel('Full name').fill('Meena');
  await page.getByLabel('Phone number').fill('91234 56789');
  await page.getByLabel('Temporary password').fill('marigold-tent-42');
  await page.getByLabel('Event Manager').check();
  await page.getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByRole('heading', { name: 'Meena' })).toBeVisible();
  await expect(page.getByText('+919123456789 · +91 91234 56789')).toBeVisible();

  // Meena signs in by phone and must change her password first.
  const meena = await browser.newPage();
  await signIn(meena, '09123456789', 'marigold-tent-42');
  await expect(meena).toHaveURL(/\/change-password/);
  await meena.waitForLoadState('networkidle');
  await meena.getByLabel('Current password').fill('marigold-tent-42');
  await meena.getByLabel('New password', { exact: true }).fill('saffron-stage-77');
  await meena.getByRole('button', { name: 'Save password' }).click();
  await expect(meena.getByRole('heading', { name: 'Welcome, Meena' })).toBeVisible();

  // She forgets it and resets with the WhatsApp code.
  const reset = await browser.newPage();
  await reset.goto('/sign-in');
  await reset.getByRole('link', { name: 'Forgot password?' }).click();
  await reset.waitForURL('**/forgot');
  await reset.waitForLoadState('networkidle');
  await reset.getByLabel('Username, email or phone').fill('+919123456789');
  await reset.getByRole('button', { name: 'Send code' }).click();
  await expect(reset.getByRole('status')).toHaveText("If an account matches, we've sent a code");
  await reset.getByLabel('6-digit code').fill(await latestCode('+919123456789'));
  await reset.getByLabel('New password', { exact: true }).fill('jasmine-hall-31');
  await reset.getByRole('button', { name: 'Set new password' }).click();
  await expect(reset.getByRole('status')).toHaveText('Password changed. Sign in with your new password.');

  // Her old session ended with the reset.
  await meena.reload();
  await expect(meena).toHaveURL(/\/sign-in/);

  // Owner deactivates her; she can no longer sign in.
  await page.reload();
  await page.getByLabel('Reason').fill('Left the company');
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Deactivated', { exact: false }).first()).toBeVisible();
  await signIn(meena, '+919123456789', 'jasmine-hall-31');
  await expect(meena.locator('p.error[role=alert]')).toHaveText('Username or password is incorrect');
});
