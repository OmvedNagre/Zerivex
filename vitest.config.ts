import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'node:fs';

// Unit tests never inherit application credentials or connect to the application's database.
// Live-database suites require an explicit, disposable TEST_DATABASE_URL.
const integration = process.env.ZERIVEX_INTEGRATION_TESTS === 'true';
if (integration && !process.env.TEST_DATABASE_URL) throw new Error('Integration tests require a disposable TEST_DATABASE_URL');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://127.0.0.1:5432/zerivex_test_not_configured';
process.env.SESSION_SECRET ||= 'zerivex-hermetic-test-secret-not-for-production';
process.env.INITIAL_OWNER_EMAIL ||= 'owner@zerivex-test.local';
const testDirectory = path.resolve(__dirname, 'tests/security');
const databaseSuites = fs.readdirSync(testDirectory).filter((name) => {
  const source = fs.readFileSync(path.join(testDirectory, name), 'utf8');
  return source.includes("from '@/core/db/database'") && !source.includes("vi.mock('@/core/db/database'");
}).map((name) => `tests/security/${name}`);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup/database-isolation.ts'],
    exclude: integration ? [] : databaseSuites,
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

