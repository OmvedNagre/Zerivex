import fs from 'fs';
import path from 'path';
import { query, withTransaction, closeDbPool } from '@/core/db/database';

/**
 * Ensures the schema_migrations table exists to track applied migrations.
 */
async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Execute pending SQL migrations in alphabetical order.
 */
export async function runMigrations(): Promise<string[]> {
  await ensureMigrationsTable();

  const migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedMigrations: string[] = [];

  for (const file of files) {
    const existing = await query(
      'SELECT id FROM schema_migrations WHERE migration_name = $1',
      [file]
    );

    if (existing.rows.length === 0) {
      console.log(`[ZERIVEX MIGRATION] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
      });

      appliedMigrations.push(file);
      console.log(`[ZERIVEX MIGRATION] Successfully applied: ${file}`);
    } else {
      console.log(`[ZERIVEX MIGRATION] Already applied: ${file}`);
    }
  }

  return appliedMigrations;
}

// Allow running directly via CLI (e.g. `npx tsx src/core/db/migrate.ts`)
if (require.main === module) {
  runMigrations()
    .then((applied) => {
      console.log(`[ZERIVEX MIGRATION] Finished. Applied ${applied.length} new migration(s).`);
      return closeDbPool();
    })
    .catch((err) => {
      console.error('[ZERIVEX MIGRATION FATAL] Migration failed:', err);
      process.exit(1);
    });
}
