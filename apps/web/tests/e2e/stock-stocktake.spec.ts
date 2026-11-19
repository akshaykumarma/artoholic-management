import { test, expect } from '@playwright/test';

// Runs after the other stock-* specs (alphabetical, one worker): MAIN holds 37 chairs.
test('ad-hoc count → submit → approve the variance (007 quickstart 4)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

  await page.goto('/counts', { waitUntil: 'networkidle' });
  const form = page.getByRole('form', { name: 'Start a count now' });
  await form.getByLabel('MAIN · Main warehouse').check();
  await form.getByLabel('Priya').check();
  await form.getByRole('button', { name: 'Start a count now' }).click();
  await expect(form.getByRole('status')).toBeVisible();
  await page.getByRole('link', { name: /^CNT-\d{4}-0001$/ }).click();
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/^Counted · MAIN-DEFAULT · White Chiavari Chair$/).fill('36');
  await page.getByRole('button', { name: 'Submit count' }).click();
  await expect(page.getByRole('status')).toHaveText('Submitted');

  await page.getByRole('link', { name: 'Review variances' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('cell', { name: '-1.000' })).toBeVisible();
  await page.getByLabel('Reason').fill('one chair missing');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Completed · Total variance/)).toBeVisible();
});
