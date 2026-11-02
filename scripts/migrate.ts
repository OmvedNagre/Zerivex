try { process.loadEnvFile('.env.local'); } catch { /* deployment may supply the environment */ }

async function main() {
  const { runMigrations } = await import('../src/core/db/migrate');
  const { closeDbPool } = await import('../src/core/db/database');
  try { await runMigrations(); } finally { await closeDbPool(); }
}
main().catch(() => { console.error('[MIGRATIONS] Migration failed'); process.exitCode = 1; });
