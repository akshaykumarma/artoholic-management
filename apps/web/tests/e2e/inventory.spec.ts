import { test, expect } from '@playwright/test';

test('catalogue → opening stock → correction (003 quickstart 1, 4)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

  await page.goto('/inventory/categories', { waitUntil: 'networkidle' });
  await page.getByLabel('Name').fill('Furniture');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Furniture').first()).toBeVisible();

  await page.goto('/inventory/warehouses', { waitUntil: 'networkidle' });
  await page.getByLabel('Code').fill('MAIN');
  await page.getByLabel('Name').fill('Main warehouse');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('cell', { name: 'MAIN', exact: true })).toBeVisible();

  await page.goto('/inventory/new', { waitUntil: 'networkidle' });
  await page.getByLabel('Name').fill('White Chiavari Chair');
  await page.getByLabel('Category').selectOption({ label: 'Furniture' });
  await page.getByLabel('Replacement value (₹ per unit)').fill('1500');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByRole('heading', { name: /White Chiavari Chair · ITM-00001/ })).toBeVisible();

  await page.getByLabel('Add opening stock').getByLabel('Quantity').fill('40');
  await page.getByLabel('Add opening stock').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByTestId('total-available')).toHaveText('40');

  const correct = page.getByLabel('Correct stock');
  await correct.getByLabel('Change').fill('-3');
  await correct.getByLabel('Reason').fill('found broken in storage');
  await correct.getByRole('button', { name: 'Submit' }).click();
  await expect(correct.getByRole('status')).toHaveText('Stock updated');
  await expect(page.getByTestId('total-available')).toHaveText('37');
});
