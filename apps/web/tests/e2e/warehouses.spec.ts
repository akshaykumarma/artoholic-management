import { test, expect } from '@playwright/test';

test('warehouse layout → bulk bins → find a bin (004 quickstart 1–2)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

  await page.goto('/warehouses', { waitUntil: 'networkidle' });
  await page.getByLabel('Code').fill('NORTH');
  await page.getByLabel('Name').fill('North godown');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('link', { name: 'NORTH', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'NORTH · North godown' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  const settings = page.getByRole('form', { name: 'Save warehouse' });
  await settings.getByLabel('Location levels (largest first, comma separated)').fill('Aisle, Row');
  await settings.getByLabel('Address').fill('Plot 4, Peenya');
  await settings.getByRole('button', { name: 'Save warehouse' }).click();
  await expect(page.getByText('Layout: Aisle › Row')).toBeVisible();
  await page.waitForLoadState('networkidle');

  const bulk = page.getByRole('form', { name: 'Create bins in bulk' });
  await bulk.getByLabel('Aisle').fill('A-B');
  await bulk.getByLabel('Row').fill('1-3');
  await bulk.getByRole('button', { name: 'Preview' }).click();
  await expect(bulk.getByRole('status')).toHaveText('6 new, 0 already exist');
  await bulk.getByRole('button', { name: 'Create 6 bins' }).click();
  await expect(bulk.getByRole('status')).toHaveText('Created 6 bins');
  await expect(page.getByText(/6 bins/).first()).toBeVisible();

  await page.getByLabel('Find location').fill('B-03');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByRole('cell', { name: 'NORTH-B-03 · Bin' })).toBeVisible();
});
