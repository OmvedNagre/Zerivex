import { Pool } from 'pg';

export function loadLocalEnvironment() {
  try { process.loadEnvFile('.env.local'); } catch { /* CI may supply configuration */ }
}
export function databasePool(connectionString: string, schema?: string) {
  const url = new URL(connectionString);
  if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
  const sslMode = url.searchParams.get('sslmode');
  const tls = sslMode !== 'disable' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  url.searchParams.delete('sslmode');
  if (schema) url.searchParams.set('options', `-c search_path=${schema},public`);
  return new Pool({ connectionString: url.toString(), ssl: tls ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA || undefined } : undefined,
    max: 5, connectionTimeoutMillis: 15000 });
}
export function directDatabaseUrl(connectionString: string, schema?: string) {
  const url = new URL(connectionString);
  if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
  if (schema) url.searchParams.set('options', `-c search_path=${schema},public`);
  return url.toString();
}
export function quoteIdentifier(value: string) { return `"${value.replaceAll('"', '""')}"`; }
