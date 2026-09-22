import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnvConfig, _resetConfigForTesting } from '@/core/config/env-validator';

describe('Configuration Security Controls (Fail-Closed)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetConfigForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetConfigForTesting();
  });

  it('fails closed when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.INITIAL_OWNER_EMAIL = 'owner@zerivex.local';

    expect(() => getEnvConfig()).toThrow(/DATABASE_URL/);
  });

  it('fails closed when SESSION_SECRET is too short (< 32 chars)', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/zerivex';
    process.env.SESSION_SECRET = 'short-secret';
    process.env.INITIAL_OWNER_EMAIL = 'owner@zerivex.local';

    expect(() => getEnvConfig()).toThrow(/SESSION_SECRET must be at least 32 characters/);
  });

  it('fails closed when INITIAL_OWNER_EMAIL is not a valid email', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/zerivex';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.INITIAL_OWNER_EMAIL = 'not-an-email';

    expect(() => getEnvConfig()).toThrow(/INITIAL_OWNER_EMAIL must be a valid email/);
  });

  it('passes validation when all required security parameters are provided', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/zerivex';
    process.env.SESSION_SECRET = 'super-secret-random-token-32-chars-long';
    process.env.INITIAL_OWNER_EMAIL = 'owner@zerivex.local';

    const config = getEnvConfig();
    expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/zerivex');
    expect(config.INITIAL_OWNER_EMAIL).toBe('owner@zerivex.local');
    expect(config.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
