import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { databasePool, directDatabaseUrl, loadLocalEnvironment } from './lib/environment';
loadLocalEnvironment();
function stop(child: ChildProcess | undefined) {
  if (child?.pid && child.exitCode === null) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already stopped */ } }
}
async function main() {
  const url = process.env.TEST_DATABASE_URL || (process.argv.includes('--temporary-schema') ? process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL : undefined);
  if (!url) throw new Error('Set TEST_DATABASE_URL or explicitly use --temporary-schema');
  const schema = `zerivex_browser_${randomUUID().replaceAll('-', '')}`;
  const admin = databasePool(url); let created = false; let server: ChildProcess | undefined; let worker: ChildProcess | undefined;
  const fixture = path.join(os.tmpdir(), `${schema}.json`);
  const browserWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'zerivex-browser-workspace-'));
  await fs.chmod(browserWorkspace, 0o700);
  const logFile = await fs.open(path.join(os.tmpdir(), `${schema}.log`), 'w', 0o600);
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
    Object.assign(process.env, { DATABASE_URL: directDatabaseUrl(url, schema), NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3101',
      INITIAL_OWNER_EMAIL: 'browser-owner@example.test', STAFF_ALLOWED_EMAILS: 'browser-owner@example.test', SESSION_SECRET: 'isolated-browser-session-secret-not-production',
      GOOGLE_CLIENT_ID: 'browser-fixture.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'browser-fixture-google-secret',
      GITHUB_CLIENT_ID: 'browser-fixture-github-client', GITHUB_CLIENT_SECRET: 'browser-fixture-github-secret',
      STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', TRUST_PROXY_HEADERS: 'true', E2E_BASE_URL: 'http://127.0.0.1:3101', E2E_FIXTURE_PATH: fixture });
    const { runMigrations } = await import('../src/core/db/migrate'); await runMigrations();
    const { query, closeDbPool } = await import('../src/core/db/database');
    const { getUserActiveOrganization } = await import('../src/core/auth/organization-context');
    const { createSession } = await import('../src/core/auth/session-service');
    const { createStaffSession, ensureStaffInternalOrgMembership } = await import('../src/core/staff/staff-session-service');
    const userId = (await query<{ id: string }>("INSERT INTO users (email, display_name) VALUES ('browser-owner@example.test','Browser Test Owner') RETURNING id")).rows[0]!.id;
    const org = await getUserActiveOrganization(userId);
    await query("INSERT INTO subscriptions (organization_id,plan_id) VALUES ($1,'TEAM')", [org.organizationId]);
    await query('INSERT INTO user_profiles (user_id,onboarding_completed_at) VALUES ($1,NOW())', [userId]);
    await query("INSERT INTO platform_roles (user_id,role) VALUES ($1,'STAFF_OWNER')", [userId]);
    await ensureStaffInternalOrgMembership(userId, 'STAFF_OWNER');
    const customer = await createSession({ userId }); const staff = await createStaffSession({ userId });
    const {inviteMember} = await import('../src/core/teams/team-service');
    const invitedUsers: Record<string,{recipientToken:string;invitationToken:string}> = {};
    for (const project of ['desktop','mobile']) {
      const email=`browser-invitee-${project}@example.test`;
      const recipientId=(await query<{id:string}>("INSERT INTO users (email,display_name,email_verified_at) VALUES ($1,'Invited Engineer',NOW()) RETURNING id",[email])).rows[0]!.id;
      const recipient=await createSession({userId:recipientId});
      const invitation=await inviteMember({organizationId:org.organizationId,email,role:'ORG_MEMBER',actorUserId:userId});
      invitedUsers[project]={recipientToken:recipient.rawToken,invitationToken:invitation.rawToken};
    }
    await fs.writeFile(fixture, JSON.stringify({ customerToken: customer.rawToken, staffToken: staff.rawToken, organizationId: org.organizationId, invitedUsers }), { mode: 0o600 });
    await closeDbPool();
    // A separate source copy prevents generated Next.js types from racing a user's dev server.
    for (const entry of ['src', 'public', 'package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.mjs']) {
      await fs.cp(path.resolve(entry), path.join(browserWorkspace, entry), { recursive: true });
    }
    await fs.symlink(path.resolve('node_modules'), path.join(browserWorkspace, 'node_modules'), 'dir');
    const env = { ...process.env, ZERIVEX_DIST_DIR: '.next-browser' };
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3101'], { env, cwd: browserWorkspace, detached: true, stdio: ['ignore', logFile.fd, logFile.fd] });
    worker = spawn(process.execPath, ['--import', 'tsx', 'scripts/worker.ts'], { env, detached: true, stdio: ['ignore', logFile.fd, logFile.fd] });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error('Browser test server exited; inspect its temporary log');
      try { if ((await fetch('http://127.0.0.1:3101/api/health/live')).ok) { ready = true; break; } } catch { /* booting */ }
      await pause(500);
    }
    if (!ready) throw new Error('Browser test server did not become ready');
    // Compile routes before accessibility tooling instruments the document.
    for (const route of ['/privacy', '/terms', '/acceptable-use', '/security', '/api/auth/session']) {
      await fetch(`http://127.0.0.1:3101${route}`);
    }
    const args = process.argv.slice(2).filter((arg) => arg !== '--temporary-schema');
    const testProcess = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...args], { env, stdio: 'inherit' });
    const code = await new Promise<number>((resolve) => testProcess.on('exit', (status) => resolve(status ?? 1)));
    process.exitCode = code;
  } finally {
    stop(worker); stop(server); await pause(1000);
    const { closeDbPool } = await import('../src/core/db/database'); await closeDbPool();
    if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end(); await logFile.close(); await fs.rm(fixture, { force: true });
    await fs.rm(browserWorkspace, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => { console.error('Browser verification failed:', error instanceof Error ? error.message : 'Unknown failure'); process.exitCode = 1; });
