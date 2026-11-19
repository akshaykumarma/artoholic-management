import { test, expect } from '@playwright/test';

// Runs after inventory.spec (alphabetical, one worker): MAIN holds 37 White Chiavari Chairs.
test('event form shows live availability and saves a draft (005 quickstart 1)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

  await page.goto('/events/new', { waitUntil: 'networkidle' });
  await page.getByLabel('Event name').fill('Sharma–Verma wedding');
  await page.getByLabel('Venue name').fill('Palace Grounds');
  await page.getByLabel('Leaves the warehouse').fill('2027-01-10T09:00');
  await page.getByLabel('Starts').fill('2027-01-10T18:00');
  await page.getByLabel('Ends').fill('2027-01-11T23:00');
  await page.getByLabel('Expected return date').fill('2027-01-12');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item', { exact: true }).selectOption({ label: 'ITM-00001 · White Chiavari Chair' });
  await page.getByLabel('Quantity', { exact: true }).fill('50');
  await expect(page.getByTestId('avail-0-0')).toHaveText('37 available — 13 short');
  await page.getByLabel('Quantity', { exact: true }).fill('20');
  await expect(page.getByTestId('avail-0-0')).toHaveText('37 available');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: /Sharma–Verma wedding · EVT-\d{4}-0001/ })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
});
