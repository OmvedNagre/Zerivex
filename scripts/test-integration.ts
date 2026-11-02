import { spawn } from 'node:child_process';
import { loadLocalEnvironment, directDatabaseUrl } from './lib/environment';
loadLocalEnvironment();
const url = process.env.TEST_DATABASE_URL || (process.argv.includes('--temporary-schema') ? process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL : undefined);
if (!url) throw new Error('Set TEST_DATABASE_URL or explicitly use --temporary-schema to isolate suites on the configured server');
const testUrl = directDatabaseUrl(url);
const processEnv: NodeJS.ProcessEnv = { ...process.env, TEST_DATABASE_URL: testUrl, DATABASE_URL: testUrl, ZERIVEX_INTEGRATION_TESTS: 'true', NODE_ENV: 'test',
  STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', SESSION_SECRET: 'isolated-suite-secret-never-use-in-production', INITIAL_OWNER_EMAIL: 'owner@zerivex-test.local' };
const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2).filter((arg) => arg !== '--temporary-schema')], { stdio: 'inherit', env: processEnv });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
