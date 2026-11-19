import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page, username: string, password = 'e2e-password-123') {
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signInAndWait(page: Page, username: string) {
  await page.goto('/sign-in');
  await signIn(page, username);
  await expect(page).not.toHaveURL(/\/sign-in/);
}

test('Super Admin signs in and sees the role menu (US1-1)', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2F/);
  await signIn(page, 'owner');
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Home', 'Users & roles', 'Inventory', 'Platform status', 'Display conventions']);
});

test('signed-out visitor is returned to the page they asked for (US1-5)', async ({ page }) => {
  await page.goto('/admin/status');
  await expect(page).toHaveURL(/returnTo=%2Fadmin%2Fstatus/);
  await signIn(page, 'owner');
  await expect(page).toHaveURL(/\/admin\/status$/);
  await expect(page.getByRole('heading', { name: 'Platform status' })).toBeVisible();
  await expect(page.getByTestId('part-database')).toHaveText('OK');
});

test('wrong password shows one generic message (US1-6)', async ({ page }) => {
  await page.goto('/sign-in');
  await signIn(page, 'owner', 'not-the-password');
  await expect(page.locator('p.error[role=alert]')).toHaveText('Username or password is incorrect');
});

test('a user without access sees the access message, not the page (US1-4)', async ({ page }) => {
  await signInAndWait(page, 'priya');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(['Home', 'Inventory']);
  await page.goto('/admin/status');
  await expect(page.getByRole('heading', { name: "You don't have access to this page" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Platform status' })).toHaveCount(0);
});

test('display conventions page shows the reference values (US2)', async ({ page }) => {
  await signInAndWait(page, 'owner');
  await page.goto('/reference/conventions');
  await expect(page.getByTestId('sample-dt')).toHaveText('20-11-2026 00:00 IST');
  await expect(page.getByTestId('sample-money')).toHaveText('₹12,34,567.50');
  await expect(page.getByTestId('sample-evt')).toHaveText('EVT-2026-0001');
});

test('sign-out ends the session', async ({ page }) => {
  await signInAndWait(page, 'owner');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
});
