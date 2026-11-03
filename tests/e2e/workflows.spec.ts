import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
interface Fixture { customerToken: string; staffToken: string; organizationId: string; invitedUsers: Record<string,{recipientToken:string;invitationToken:string}> }
const fixture = (): Fixture => JSON.parse(fs.readFileSync(process.env.E2E_FIXTURE_PATH!, 'utf8'));
test.beforeEach(async ({ context }, testInfo) => {
 const testIp = createHash('sha256').update(testInfo.testId).digest();
 await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.18.${testIp[0]}.${testIp[1]}` });
  const data = fixture();
  await context.addCookies([{ name: 'zerivex_session', value: data.customerToken, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'zx_staff_session', value: data.staffToken, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
});

test('legal drafts, contact routes, mobile layout and accessibility', async ({ page }) => {
  for (const path of ['/privacy', '/terms', '/acceptable-use', '/security']) {
    await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'zerivex.secure@gmail.com' }).first()).toBeVisible();
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
  await expect(page.getByText('Local checkout simulation completed. No payment was taken or subscription changed.')).toHaveCount(0);
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

test('launch access restrictions and public plan comparison', async ({ page }) => {
  expect((await page.request.get('/api/auth/login/mock')).status()).toBe(400);
  expect((await page.request.get('/api/auth/mock-consent')).status()).toBe(404);
  expect((await page.request.get('/dev/ui')).status()).toBe(404);
  await page.goto('/pricing');
  const headers = page.getByRole('columnheader');
  await expect(headers).toHaveCount(5);
  for (const plan of ['Starter', 'Pro', 'Team', 'Enterprise']) {
    await expect(headers.filter({ hasText: plan })).toHaveCount(1);
  }
  await expect(page.getByText('Localhost Developer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upgrade to Pro', exact: true })).toBeVisible();
  await expect(page.getByText('Failed scans never consume your count')).toHaveCount(0);
});

test('profile breadcrumbs have no duplicate-key console error', async ({ page }) => {
  const errors:string[]=[];page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto('/dashboard/settings/profile');
  await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toContainText('Settings');
  await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toContainText('Profile');
  expect(errors.filter(e=>e.includes('same key'))).toEqual([]);
});

test('invitation acceptance activates the invited workspace and completes onboarding', async ({ page, context }, testInfo) => {
  const shared=fixture();
  const data={...shared,...shared.invitedUsers[testInfo.project.name]!};
  await context.addCookies([{name:'zerivex_session',value:data.recipientToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
  await page.goto(`/invite/${data.invitationToken}`);
  await expect(page.getByRole('button',{name:'Accept the role',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Accept the role',exact:true}).click();
  await page.waitForURL('**/onboarding/team');
  await expect(page.getByRole('heading',{name:/Welcome to/})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Display name').fill('Invited Engineer');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Enter workspace'}).click();
  await page.waitForURL('**/dashboard');
  const session=await (await page.request.get('/api/auth/session')).json();
  expect(session.organizationId).toBe(data.organizationId);
  expect(session.organizationRole).toBe('ORG_MEMBER');
});

test('scanner monitoring exposes a live idle heartbeat only to authenticated staff', async ({ page }) => {
  const response=await page.request.get('/api/staff/queue');expect(response.ok()).toBe(true);
  const body=await response.json();expect(body.data.workerHealth.online).toBe(true);
  expect(body.data.workerHealth.workers.length).toBeGreaterThan(0);
  expect((await page.request.get('/api/health/worker')).status()).toBe(401);
});

test('Google and GitHub login starts use PKCE, distinct browser cookies and exact callbacks', async ({ page }) => {
  for (const provider of ['google','github']) {
    const response=await page.request.get(`/api/auth/login/${provider}?returnTo=%2Finvite%2Ftest-return`,{maxRedirects:0});
    expect(response.status()).toBe(307);
    const url=new URL(response.headers().location!);
    expect(url.searchParams.get('redirect_uri')).toBe(`${process.env.E2E_BASE_URL}/api/auth/callback/${provider}`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{48}$/);
    expect(response.headers()['set-cookie']).toContain(`zerivex_oauth_${provider}=`);
    expect(response.headers()['set-cookie']).toContain('HttpOnly');
  }
});

test('staff sign-in starts the isolated Google staff flow', async ({ page }) => {
  await page.route('https://accounts.google.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>Provider request intercepted for testing</h1>'}));
  await page.goto('/staff/login');
  const providerRequest=page.waitForRequest(r=>r.url().startsWith('https://accounts.google.com/'));
  await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
  const request=await providerRequest;
  const url=new URL(request.url());
  expect(url.searchParams.get('redirect_uri')).toBe(`${process.env.E2E_BASE_URL}/api/staff/auth/callback`);
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
});

test('scan panel contrast and homepage footer spacing', async ({ page }, testInfo) => {
  await page.goto('/dashboard');
  const title = page.getByRole('heading', { name: 'Quick Vulnerability Scan' });
  await expect(title).toHaveCSS('color', 'rgb(233, 234, 240)');
  const input = page.locator('#quick-scan-url');
  await expect(input).toHaveCSS('background-color', 'rgb(28, 31, 39)');
  await expect(input).toHaveCSS('color', 'rgb(233, 234, 240)');
  await title.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/zerivex-scan-panel-${testInfo.project.name}.png` });
  await page.goto('/');
  const cta = page.getByRole('heading', { name: 'Find what shipped with your AI app.' });
  const section = cta.locator('xpath=ancestor::section');
  const footer = page.locator('footer');
  await expect(footer).toBeAttached();
  const ctaBox = await section.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(ctaBox).not.toBeNull(); expect(footerBox).not.toBeNull();
  expect(footerBox!.y - (ctaBox!.y + ctaBox!.height)).toBeGreaterThanOrEqual(40);
  await expect(footer.getByRole('img', { name: 'Zerivex', exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await cta.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/zerivex-home-footer-${testInfo.project.name}.png` });
});
