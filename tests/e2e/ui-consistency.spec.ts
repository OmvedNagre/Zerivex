import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const fixture = () => JSON.parse(fs.readFileSync(process.env.E2E_FIXTURE_PATH!, 'utf8'));
test.beforeEach(async ({ context }, testInfo) => {
 const testIp = createHash('sha256').update(testInfo.testId).digest();
 await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.18.${testIp[0]}.${testIp[1]}` });
 const data=fixture();
 await context.addCookies([{name:'zerivex_session',value:data.customerToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'},
 {name:'zx_staff_session',value:data.staffToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
});

for (const [route, heading] of [
 ['/dashboard','Welcome back'], ['/dashboard/targets','Your sites'], ['/dashboard/scans','Scans'],
 ['/dashboard/findings','Findings'], ['/dashboard/automation','Schedules & CI Gates'], ['/dashboard/launch-readiness','Launch'],
 ['/dashboard/team','Team Management'], ['/dashboard/agency','Agency Hub'],
 ['/dashboard/billing','Subscription & Billing'], ['/dashboard/settings/profile','Profile'],
 ['/dashboard/settings/security','Account Security & Sessions'], ['/dashboard/settings/api-keys','API Keys & Automation Tokens'],
 ['/dashboard/settings/webhooks','Outbound Webhooks'], ['/dashboard/academy','Security Academy & Playbooks'],
] as const) {
 test(`customer layout and accessibility: ${route}`,async({page},info)=>{
  await page.goto(route);
  await expect(page.getByRole('heading',{level:1})).toContainText(heading);
  await expect(page.getByText('STAFF MODE · Zerivex Internal',{exact:false})).toHaveCount(0);
  if(route === '/dashboard/launch-readiness') { await expect(page.getByRole('button',{name:'Run ZERIVEX Autonomous Self-Scan Engine'})).toBeDisabled(); await expect(page.locator('#self-scan-permission')).toBeVisible(); }
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
  await expect(page.getByRole('heading',{level:1})).toHaveCSS('color','rgb(25, 27, 35)');
  const result=await new AxeBuilder({page}).include('.zx-page-viewport').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}))).toEqual([]);
  await page.screenshot({path:info.outputPath('page.png'),fullPage:true});
 });
}
for(const [route,button,title] of [
 ['/dashboard/settings/api-keys','Generate New API Key','Generate API Key'],
 ['/dashboard/settings/webhooks','Register Webhook','Register webhook'],
 ['/dashboard/team','Invite Member','Invite team member'],
] as const){
 test(`shared dialog focus and Escape: ${route}`,async({page})=>{
  await page.goto(route);const opener=page.getByRole('button',{name:button,exact:false}).first();await opener.click();
  const dialog=page.getByRole('dialog',{name:title,exact:false});await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(()=>getComputedStyle(document.body).overflow)).toBe('hidden');
  const result=await new AxeBuilder({page}).include('[role=dialog]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
 });
}
test('staff queue errors never claim the queue is healthy',async({page})=>{
 await page.route('**/api/staff/queue',r=>r.fulfill({status:503,json:{success:false,error:'Unavailable'}}));
 await page.goto('/staff/queue');await expect(page.locator('.staff-error')).toContainText('Unable to load');
 await expect(page.getByText('Queue state unavailable.')).toBeVisible();
 await expect(page.getByText(/queue is currently clear|Zero active failures/)).toHaveCount(0);
 await page.goto('/staff'); await expect(page.locator('.staff-error')).toContainText('Operational metrics could not be loaded');
 await expect(page.locator('.staff-card').getByText('—',{exact:true})).toHaveCount(4);
});
test('native confirmations are replaced with accessible confirmation dialogs',async({page})=>{
 await page.goto('/dashboard/settings/security');
 await page.getByRole('button',{name:/sign out.*all|revoke all/i}).click();
 const dialog=page.getByRole('alertdialog');await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
});
test('Academy article navigation retains the customer shell',async({page})=>{
 await page.goto('/dashboard/academy');
 const article=page.locator('a[href^="/dashboard/academy/"]').first();await expect(article).toBeVisible();await article.click();
 await expect(page.locator('.zx-dashboard-content-wrapper')).toBeVisible();await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await expect(page.locator('footer')).toHaveCount(0);
});
test('Enterprise feature restriction has an upgrade explanation',async({page})=>{
 await page.goto('/dashboard/audit-vault');await expect(page.getByText('This feature requires Enterprise access and an authorized organization role.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Export SIEM JSON'})).toHaveCount(0);
});
test('staff mobile switcher and record tables stay usable',async({page})=>{
 await page.goto('/staff/orgs');await expect(page.getByRole('heading',{level:1})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
 const result=await new AxeBuilder({page}).include('.staff-root').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))).toEqual([]);
});

for(const route of ['/staff','/staff/staff','/staff/queue','/staff/security-events','/staff/audit']) {
 test(`staff layout and accessibility: ${route}`,async({page})=>{
  await page.goto(route);await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
  if(route === '/staff/queue') { const response = await page.request.get('/api/staff/queue'); expect(response.ok()).toBe(true); expect(typeof (await response.json()).data.stats.scansLast24h).toBe('number'); }
  const result=await new AxeBuilder({page}).include('.staff-root').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}))).toEqual([]);
 });
}
test('target subpages and failed scan results preserve layout and truthful states',async({page})=>{
 test.setTimeout(150000);
 const headers={'X-Requested-With':'XMLHttpRequest'};
 const response=await page.request.post('/api/targets',{headers,data:{targetUrl:`https://ui-regression-${Date.now()}.invalid`}});
 expect(response.ok()).toBe(true);const target=(await response.json()).data.target;
 const launched=await page.request.post('/api/v1/ci/scan',{headers,data:{targetId:target.id,wait:false}});
 expect(launched.ok()).toBe(true);const scan=await launched.json();
 await expect.poll(async()=>(await(await page.request.get(scan.pollUrl)).json()).scanJob.status,{timeout:45000}).toBe('FAILED');
 for(const route of [`/dashboard/targets/${target.id}`,`/dashboard/targets/${target.id}/surface`,`/dashboard/targets/${target.id}/monitoring`,`/dashboard/targets/${target.id}/ci-cd`,`/dashboard/scans/${scan.scanId}`]) {
  await page.goto(route);await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
  await expect(page.getByRole('heading',{level:1})).toHaveCSS('color','rgb(25, 27, 35)');
  const result=await new AxeBuilder({page}).include('.zx-page-viewport').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({route,id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}))).toEqual([]);
 }
 await expect(page.getByText('Assessment incomplete — no security score')).toBeVisible();
 await page.getByRole('combobox',{name:'Severity filter',exact:false}).selectOption('CRITICAL');
 await expect(page.getByText('All deterministic checks passed with clean responses.')).toHaveCount(0);
});
