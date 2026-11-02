import { Pool, QueryResult, QueryResultRow } from 'pg';
import { getEnvConfig } from '@/core/config/env-validator';

let pool: Pool | null = null;

/**
 * Get or initialize the singleton PostgreSQL Connection Pool.
 */
export function getDbPool(): Pool {
  if (!pool) {
    const config = getEnvConfig();
    const connectionUrl = new URL(config.DATABASE_URL);
    const useTls = config.NODE_ENV === 'production' ||
      ['require', 'verify-ca', 'verify-full'].includes(connectionUrl.searchParams.get('sslmode') || '');
    // pg connection-string SSL parameters must not override certificate validation.
    if (useTls) connectionUrl.searchParams.delete('sslmode');
    pool = new Pool({
      connectionString: connectionUrl.toString(),
      max: 20, // Max clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: useTls ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA || undefined } : undefined,
    });

    pool.on('error', (err) => {
      console.error('[ZERIVEX DB ERROR] Unexpected error on idle PostgreSQL client:', err.message);
    });
  }

  return pool;
}

/**
 * Execute a parameterized query against PostgreSQL.
 * Guarantees parameters are safely passed to prevent SQL injection.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const db = getDbPool();
  const start = Date.now();
  try {
    const res = await db.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[ZERIVEX SLOW QUERY] (${duration}ms): ${text.substring(0, 100)}...`);
    }
    return res;
  } catch (error) {
    console.error(`[ZERIVEX QUERY ERROR] Query failed: ${text.substring(0, 100)}...`, (error as Error).message);
    throw error;
  }
}

/**
 * Helper to run statements inside an explicit atomic database transaction.
 */
export async function withTransaction<T>(
  callback: (client: { query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<R>> }) => Promise<T>
): Promise<T> {
  const db = getDbPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database pool (useful for test teardown and graceful server shutdown).
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
