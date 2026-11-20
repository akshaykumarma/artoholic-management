import { test, expect } from '@playwright/test';

test('console: audit search and export, company profile, master lists (010 US1, US3)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin console' }).click();
  await page.getByRole('link', { name: 'Audit log' }).click();
  await page.getByLabel('Action starts with').fill('auth.sign_in');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('cell', { name: 'auth.sign_in', exact: true }).first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export to Excel' }).click();
  expect((await download).suggestedFilename()).toBe('audit-log.xlsx');

  await page.goto('/admin/profile', { waitUntil: 'networkidle' });
  await page.getByLabel('GSTIN').fill('NOT-A-GSTIN');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.locator('p.error[role=alert]')).toContainText('GSTIN');
  await page.getByLabel('GSTIN').fill('29ABCDE1234F1Z5');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('form', { name: 'Save profile' }).getByRole('status')).toBeVisible();

  await page.goto('/admin/lists', { waitUntil: 'networkidle' });
  const reasons = page.locator('section', { has: page.getByRole('heading', { name: 'Damage reasons' }) });
  await reasons.getByLabel('Add').fill('Termite damage');
  await reasons.getByRole('button', { name: 'Add' }).click();
  await expect(reasons.getByRole('cell', { name: 'Termite damage' })).toBeVisible();
});
