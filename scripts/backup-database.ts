import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { databasePool, directDatabaseUrl, loadLocalEnvironment, quoteIdentifier } from './lib/environment';
loadLocalEnvironment();
async function binary(name: string) {
  for (const candidate of [process.env[`PG_${name.toUpperCase()}_PATH`], `/opt/homebrew/opt/libpq/bin/${name}`, `/usr/lib/postgresql/18/bin/${name}`, name]) {
    if (!candidate) continue;
    try { if (!candidate.includes('/')) return candidate; await fs.access(candidate); return candidate; } catch { /* next candidate */ }
  }
  throw new Error(`PostgreSQL client ${name} unavailable`);
}
function command(executable: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let diagnostic = '';
    child.stderr.on('data', (chunk: Buffer) => { if (diagnostic.length < 2000) diagnostic += chunk.toString(); });
    child.on('error', () => reject(new Error('PostgreSQL client could not start')));
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`PostgreSQL client exited with status ${code}: ${diagnostic.slice(0, 1000)}`)));
  });
}
async function main() {
  const value = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
  if (!value) throw new Error('Configure DATABASE_URL');
  const url = new URL(directDatabaseUrl(value));
  const tls = !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const pgEnv: NodeJS.ProcessEnv = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: tls ? 'verify-full' : 'disable',
    ...(tls ? { PGSSLROOTCERT: 'system' } : {}) };
  const admin = databasePool(value);
  const directory = path.resolve('.backups');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, `zerivex-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.dump`);
  const manifest: { createdAt: string; checksum?: string; tables: Record<string, number>; restored?: boolean } = { createdAt: new Date().toISOString(), tables: {} };
  const snapshot = await admin.connect();
  try {
    await snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshotId = (await snapshot.query<{ id: string }>('SELECT pg_export_snapshot() as id')).rows[0]!.id;
    const tables = await snapshot.query<{ schemaname: string; tablename: string }>("SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    for (const table of tables.rows) {
      const identifier = `${quoteIdentifier(table.schemaname)}.${quoteIdentifier(table.tablename)}`;
      manifest.tables[`${table.schemaname}.${table.tablename}`] = Number((await snapshot.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${identifier}`)).rows[0]!.count);
    }
    await command(await binary('pg_dump'), ['--format=custom', '--no-owner', '--no-acl', `--snapshot=${snapshotId}`, `--file=${target}`], pgEnv);
    await fs.chmod(target, 0o600);
    await snapshot.query('COMMIT');
    manifest.checksum = createHash('sha256').update(await fs.readFile(target)).digest('hex');
  } catch (error) { await snapshot.query('ROLLBACK'); throw error; }
  finally { snapshot.release(); }
  const restoreName = `zerivex_restore_${randomUUID().replaceAll('-', '')}`;
  let restoreCreated = false;
  try {
    if (process.argv.includes('--verify-restore')) {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(restoreName)}`); restoreCreated = true;
      await command(await binary('pg_restore'), ['--exit-on-error', '--no-owner', '--no-acl', '--dbname', restoreName, target], { ...pgEnv, PGDATABASE: restoreName });
      const restoredUrl = new URL(url); restoredUrl.pathname = `/${restoreName}`;
      const restored = databasePool(restoredUrl.toString());
      try {
        for (const [table, expected] of Object.entries(manifest.tables)) {
          const identifier = table.split('.').map(quoteIdentifier).join('.');
          const actual = Number((await restored.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${identifier}`)).rows[0]!.count);
          if (actual !== expected) throw new Error('Restored database row counts did not match the consistent snapshot');
        }
      } finally { await restored.end(); }
      manifest.restored = true;
    }
    await fs.writeFile(`${target}.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ backup: target, checksum: manifest.checksum, tables: Object.keys(manifest.tables).length, restoreVerified: manifest.restored || false }));
  } finally {
    if (restoreCreated) await admin.query(`DROP DATABASE ${quoteIdentifier(restoreName)} WITH (FORCE)`);
    await admin.end();
  }
}
main().catch((error: unknown) => { console.error('Backup/restore verification failed. Application data was not modified.', error instanceof Error ? error.message : 'Unknown failure'); process.exitCode = 1; });
