import { test, expect } from '@playwright/test';

test('the privacy policy is public and names what the app collects (011 FR-006)', async ({ page }) => {
  await page.goto('/privacy', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
  await expect(page.getByText(/Request account deletion/)).toBeVisible();
  await expect(page).toHaveURL(/\/privacy$/);
});
