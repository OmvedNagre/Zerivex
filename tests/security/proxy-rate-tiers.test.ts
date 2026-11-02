import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { check } = vi.hoisted(() => ({ check: vi.fn(() => ({ allowed: true })) }));
vi.mock('@/core/security/rate-limiter', () => ({
  defaultRateLimiter: { check }, getClientIp: () => '127.0.0.1',
  validateRequestBodySize: () => ({ valid: true }),
}));
vi.mock('@/core/security/distributed-rate-limiter', () => ({ checkDistributedRateLimit: check }));
import { proxy } from '@/proxy';
describe('API rate tiers', () => {
  beforeEach(() => { check.mockClear(); });
  it.each([
    ['/api/auth/session', 'GET', 'API_STANDARD'],
    ['/api/auth/login/google', 'GET', 'AUTH'],
    ['/api/auth/logout', 'POST', 'AUTH'],
    ['/api/v1/ci/scans/job-id', 'GET', 'API_STANDARD'],
    ['/api/v1/ci/scan', 'POST', 'SCANS'],
    ['/api/scans', 'POST', 'SCANS'],
  ])('%s %s uses %s', async (route, method, tier) => {
    await proxy(new NextRequest(`http://localhost:3000${route}`, { method }));
    expect(check).toHaveBeenCalledWith(`${tier}:127.0.0.1`, tier);
  });
});
