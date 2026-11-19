import { test, expect } from '@playwright/test';

test('notification centre and channel settings (008 US2, US3)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Notifications' }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.getByRole('link', { name: 'Notification settings' }).click();
  await page.waitForLoadState('networkidle');
  const box = page.getByLabel('Physical counts · WhatsApp');
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.getByLabel(/^Quiet hours/).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toHaveText('Settings saved');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Physical counts · WhatsApp')).not.toBeChecked();

  await page.goto('/admin/integrations', { waitUntil: 'networkidle' });
  await page.getByLabel('Send to', { exact: true }).fill('+919800012345');
  await page.getByRole('button', { name: 'Send a test message' }).click();
  await expect(page.getByRole('form', { name: 'Send a test message' }).getByRole('status')).toHaveText('sent');
  await page.goto('/admin/messages', { waitUntil: 'networkidle' });
  await expect(page.getByRole('cell', { name: '+919800012345' })).toBeVisible();
});
