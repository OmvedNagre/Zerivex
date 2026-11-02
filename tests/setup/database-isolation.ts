import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect } from 'vitest';
import { databasePool, directDatabaseUrl } from '../../scripts/lib/environment';

const sourcePath = expect.getState().testPath;
const source = sourcePath ? fs.readFileSync(sourcePath, 'utf8') : '';
const requiresDatabase = source.includes("from '@/core/db/database'") && !source.includes("vi.mock('@/core/db/database'");
if (process.env.ZERIVEX_INTEGRATION_TESTS === 'true' && requiresDatabase) {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('A disposable TEST_DATABASE_URL is required');
  const schema = `zerivex_suite_${path.basename(sourcePath || '').replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase()}_${randomUUID().replaceAll('-', '')}`;
  const admin = databasePool(testUrl);
  const originalEnv = { ...process.env };
  let created = false;
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
    process.env.DATABASE_URL = directDatabaseUrl(testUrl, schema);
    const { closeDbPool, query } = await import('@/core/db/database');
    await closeDbPool();
    const { _resetConfigForTesting } = await import('@/core/config/env-validator');
    _resetConfigForTesting();
    const { runMigrations } = await import('@/core/db/migrate');
    await runMigrations();
    expect((await query<{ schema: string }>('SELECT current_schema() as schema')).rows[0]?.schema).toBe(schema);
  }, 120000);
  afterAll(async () => {
    const { closeDbPool } = await import('@/core/db/database');
    await closeDbPool();
    if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    process.env = originalEnv;
    const { _resetConfigForTesting } = await import('@/core/config/env-validator');
    _resetConfigForTesting();
  }, 120000);
}
