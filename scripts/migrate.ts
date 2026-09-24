import fs from 'fs';
import path from 'path';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {}
}

import { query, closeDbPool } from '@/core/db/database';

async function runMigrations() {
  console.log('[ZERIVEX MIGRATIONS] Discovering migration scripts...');
  const migrationsDir = path.join(process.cwd(), 'src', 'core', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`[ZERIVEX MIGRATIONS] Applying migration: ${file}...`);
    const sql = fs.readFileSync(filePath, 'utf-8');
    await query(sql);
    console.log(`[ZERIVEX MIGRATIONS] Successfully applied: ${file}`);
  }

  console.log('[ZERIVEX MIGRATIONS] All migrations completed successfully.');
  await closeDbPool();
}

runMigrations().catch(async (err) => {
  console.error('[ZERIVEX MIGRATIONS FATAL]', err);
  await closeDbPool();
  process.exit(1);
});
