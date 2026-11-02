import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
interface Fixture { customerToken: string; staffToken: string; organizationId: string }
const fixture = (): Fixture => JSON.parse(fs.readFileSync(process.env.E2E_FIXTURE_PATH!, 'utf8'));
test.beforeEach(async ({ context }) => {
  const data = fixture();
  await context.addCookies([{ name: 'zerivex_session', value: data.customerToken, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'zx_staff_session', value: data.staffToken, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
});

test('legal drafts, contact routes, mobile layout and accessibility', async ({ page }) => {
  for (const path of ['/privacy', '/terms', '/acceptable-use', '/security']) {
    await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'code64816@gmail.com' }).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('dashboard target registration modal supports keyboard close and safe validation', async ({ page }) => {
  await page.goto('/dashboard/targets');
  await page.getByRole('button', { name: /register.*target|add target/i }).first().click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder('https://example.com')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  const response = await page.request.post('/api/targets', { headers: { 'X-Requested-With': 'XMLHttpRequest' }, data: { targetUrl: 'http://127.0.0.1:3000' } });
  expect(response.status()).toBe(400);
});

test('staff credits commit a real grant once and expose balanced activity', async ({ page }) => {
  await page.goto('/staff/credits');
  await page.getByLabel('Customer organization').selectOption(fixture().organizationId);
  await page.getByLabel('Number of credits').fill('2');
  await page.getByLabel('Operational reason').fill('Browser acceptance scan allowance');
  await page.getByRole('button', { name: 'Grant scan credits' }).click();
  await expect(page.getByRole('cell', { name: 'Browser acceptance scan allowance' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Available scan credits' })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.staff-operations').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('billing monitor displays unconfigured state without fabricated payment activity', async ({ page }) => {
  await page.goto('/staff/billing-events');
  await expect(page.getByRole('heading', { name: 'Billing event monitor' })).toBeVisible();
  await expect(page.getByText('No verified events have been received.')).toBeVisible();
  await expect(page.getByText(/Stripe credentials or the webhook signing secret are missing/)).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.staff-operations').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('staff-to-customer switch stays inside the internal organization', async ({ page }) => {
  const switched = await page.request.post('/api/staff/portal/switch', { headers: { 'X-Zerivex-Staff': 'true' }, data: { destination: 'CUSTOMER_PORTAL' } });
  expect(switched.ok()).toBe(true);
  const targets = await page.request.get('/api/targets');
  const data = await targets.json(); expect(data.data.organization.id).not.toBe(fixture().organizationId);
});

test('customer billing shows canonical plans and honest simulated checkout feedback', async ({ page }) => {
  await page.goto('/dashboard/billing?session_id=cs_sim_browser&simulated=true');
  await expect(page.getByText('Local checkout simulation completed. No payment was taken or subscription changed.')).toBeVisible();
  for (const name of ['Starter', 'Pro', 'Team', 'Enterprise']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Current tier', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose Pro' })).toBeVisible();
});

test('CI asynchronous jobs are consumed and unreachable targets never receive a clean score', async ({ page }) => {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  const targetResponse = await page.request.post('/api/targets', { headers, data: { targetUrl: `https://acceptance-${Date.now()}.invalid` } });
  expect(targetResponse.ok()).toBe(true); const target = await targetResponse.json();
  const launched = await page.request.post('/api/v1/ci/scan', { headers, data: { targetId: target.data.target.id, wait: false } });
  expect(launched.ok()).toBe(true); const job = await launched.json();
  await expect.poll(async () => (await (await page.request.get(job.pollUrl)).json()).scanJob.status, { timeout: 45000 }).toBe('FAILED');
  const final = await (await page.request.get(job.pollUrl)).json(); expect(final.scanJob.score).toBeNull();
});
