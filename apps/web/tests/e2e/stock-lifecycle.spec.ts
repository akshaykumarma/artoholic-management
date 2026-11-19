import { test, expect, type Page } from '@playwright/test';

// Runs after inventory.spec and stock-events.spec (alphabetical, one worker): MAIN holds 37 chairs.
async function apiPost(page: Page, path: string, data: unknown) {
  const csrf = (await page.context().cookies()).find((c) => c.name === 'csrf')!.value;
  const res = await page.request.post(path, { data, headers: { 'x-csrf-token': csrf, 'x-client-platform': 'web' } });
  expect(res.ok(), await res.text()).toBe(true);
  return res.json();
}

test('event lifecycle: four checklists, then close (006 quickstart 1, 4, 6–8)', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Username, email or phone').fill('owner');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

  const em = await apiPost(page, '/api/v1/users', { fullName: 'Meera EM', phone: '9811122233', username: 'meera.em', temporaryPassword: 'marigold-tent-42', roles: ['event_manager'] });
  const items = await (await page.request.get('/api/v1/catalogue/items?q=Chiavari')).json();
  const whs = await (await page.request.get('/api/v1/warehouses')).json();
  const main = whs.items.find((w: { code: string }) => w.code === 'MAIN');
  const ev = await apiPost(page, '/api/v1/events', {
    name: 'Corporate gala', venueName: 'Leela Palace', startsAt: '2027-03-01T12:30:00.000Z', endsAt: '2027-03-01T17:30:00.000Z',
    leaveWarehouseAt: '2027-03-01T03:30:00.000Z', expectedReturnDate: '2027-03-02', eventManagerIds: [em.id], schedule: true,
    lines: [{ itemId: items.items[0].id, plannedQty: '10', sources: [{ type: 'warehouse', warehouseId: main.id, qty: '10' }] }]
  });

  const runStep = async (link: string, field: string, value: string) => {
    await page.goto(`/events/${ev.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: link }).click();
    await page.waitForLoadState('networkidle');
    await page.getByLabel(`${field} · White Chiavari Chair`).fill(value);
    await page.getByRole('button', { name: 'Submit checklist' }).click();
    await expect(page.getByText(/Submitted by Owner/)).toBeVisible();
  };
  await runStep('Warehouse dispatch · MAIN', 'Dispatched', '10');
  await runStep('Site receipt', 'Received good', '10');
  await runStep('Return dispatch', 'Sent back', '10');
  await runStep('Warehouse receipt · MAIN', 'Received good', '10');

  await page.goto(`/events/${ev.id}`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Reconciling', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Reconciled' })).toBeVisible();
  await page.getByRole('button', { name: 'Close event' }).click();
  await expect(page.getByRole('status')).toHaveText('Event closed');
  await page.goto(`/events/${ev.id}`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
});
