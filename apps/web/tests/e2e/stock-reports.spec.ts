import { test, expect } from '@playwright/test';

test('admin dashboard, run a report, download Excel (009 quickstart 1)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Today at a glance' })).toBeVisible();

  await page.goto('/reports/R1', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'R1 · Stock on hand' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'White Chiavari Chair' }).first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  expect((await download).suggestedFilename()).toMatch(/^Stock-on-hand-\d{4}-\d{2}-\d{2}\.xlsx$/);
});
