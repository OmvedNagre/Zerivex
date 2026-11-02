import { databasePool, loadLocalEnvironment } from './lib/environment';
loadLocalEnvironment();
async function main() {
  const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Database is not configured');
  const db = databasePool(url);
  try {
    const tables = await db.query<{ name: string }>("SELECT tablename as name FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename");
    const migrations = tables.rows.some((table) => table.name === 'schema_migrations')
      ? (await db.query('SELECT migration_name FROM schema_migrations ORDER BY migration_name')).rows : [];
    const users = await db.query("SELECT role, COUNT(*)::int as count FROM users GROUP BY role");
    console.log(JSON.stringify({ tables: tables.rows.map((table) => table.name), migrations, usersByRole: users.rows,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY), staffAllowlistConfigured: Boolean(process.env.STAFF_ALLOWED_EMAILS || process.env.STAFF_ALLOWED_EMAIL_DOMAINS) }, null, 2));
  } finally { await db.end(); }
}
main().catch(() => { console.error('Project status check failed; no credentials were logged.'); process.exitCode = 1; });
