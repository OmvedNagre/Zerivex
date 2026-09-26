import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EgressFirewall,
  EgressBlockedError,
  assertEgressAllowed,
} from '@/core/security/egress-firewall';
import {
  WorkerPool,
  CircuitBreakerOpenError,
} from '@/core/scanner/worker-pool';
import {
  SlidingWindowRateLimiter,
  getClientIp,
  validateRequestBodySize,
} from '@/core/security/rate-limiter';
import {
  scrubSensitiveData,
  scrubString,
  isSensitiveKey,
} from '@/core/observability/scrubbing-rules';
import { StructuredLogger } from '@/core/observability/logger';
import {
  getSystemHealthReport,
  checkReadiness,
} from '@/core/observability/health-service';
import { GET as getHealth } from '@/app/api/health/route';
import { GET as getLive } from '@/app/api/health/live/route';
import { GET as getReady } from '@/app/api/health/ready/route';

describe('Phase 14: Production Hardening & Resilience Controls', () => {
  // =========================================================================
  // 1. Network Egress Firewall & SSRF Defense
  // =========================================================================
  describe('1. Network Egress Security Firewall', () => {
    const firewall = new EgressFirewall();

    it('permits legitimate public HTTP and HTTPS target URLs', async () => {
      const res = await firewall.validateUrl('https://example.com');
      expect(res.allowed).toBe(true);
      expect(res.resolvedIps).toBeDefined();
      expect(res.resolvedIps!.length).toBeGreaterThan(0);
    });

    it('strictly blocks non-HTTP protocols', async () => {
      const disallowedProtocols = [
        'file:///etc/passwd',
        'ftp://ftp.example.com/file.txt',
        'gopher://127.0.0.1:6379/_INFO',
        'dict://127.0.0.1:11211/stats',
        'ldap://internal.ad:389/dc=example',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const url of disallowedProtocols) {
        const res = await firewall.validateUrl(url);
        expect(res.allowed).toBe(false);
        expect(res.reason).toContain('Disallowed protocol');
      }
    });

    it('blocks direct private IPv4 addresses (RFC 1918 & Loopback)', async () => {
      const privateIps = [
        'http://127.0.0.1:8080/admin',
        'http://10.0.0.1/console',
        'http://172.16.0.1/api',
        'http://192.168.1.1/setup',
        'http://0.0.0.0:3000',
      ];

      for (const url of privateIps) {
        const res = await firewall.validateUrl(url);
        expect(res.allowed).toBe(false);
        expect(res.reason).toMatch(/Restricted direct IP address|prohibited IP range|Reserved local/);
      }
    });

    it('blocks direct Cloud Metadata IP and internal hostnames', async () => {
      const metadataUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://localhost:3000',
        'http://api.localhost',
      ];

      for (const url of metadataUrls) {
        const res = await firewall.validateUrl(url);
        expect(res.allowed).toBe(false);
        expect(res.reason).toMatch(/Restricted direct IP address|Restricted hostname/);
      }
    });

    it('blocks direct IPv6 loopback and unique-local private addresses', async () => {
      const ipv6Urls = [
        'http://[::1]:8080',
        'http://[fc00::1]/private',
        'http://[fe80::1]/link-local',
      ];

      for (const url of ipv6Urls) {
        const res = await firewall.validateUrl(url);
        expect(res.allowed).toBe(false);
        expect(res.reason).toMatch(
          /Restricted direct IP address|IPv6 Loopback|Unique Local|Link-Local|Reserved local/
        );
      }
    });

    it('rejects malformed or empty URLs', async () => {
      const emptyCheck = await firewall.validateUrl('');
      expect(emptyCheck.allowed).toBe(false);

      const garbageCheck = await firewall.validateUrl('not-a-valid-url');
      expect(garbageCheck.allowed).toBe(false);
    });

    it('assertEgressAllowed throws EgressBlockedError on policy violation', async () => {
      await expect(assertEgressAllowed('http://127.0.0.1/admin')).rejects.toThrow(
        EgressBlockedError
      );
    });
  });

  // =========================================================================
  // 2. Isolated Worker Pool & Concurrency Watchdog
  // =========================================================================
  describe('2. Scan Worker Pool & Concurrency Guardrails', () => {
    let pool: WorkerPool;

    beforeEach(() => {
      pool = new WorkerPool({
        maxConcurrency: 2,
        defaultTimeoutMs: 500,
        circuitBreakerThreshold: 2,
        circuitBreakerCooldownMs: 1000,
      });
    });

    afterEach(async () => {
      await pool.drainAndStop(100);
      pool.reset();
    });

    it('enforces maximum concurrency cap and queues excess jobs', async () => {
      let concurrentActive = 0;
      let peakConcurrency = 0;

      const makeTask = (id: string, durationMs: number) => {
        return pool.submitJob({
          id,
          targetId: 'target-1',
          organizationId: 'org-1',
          domain: 'example.com',
          execute: async () => {
            concurrentActive += 1;
            peakConcurrency = Math.max(peakConcurrency, concurrentActive);
            await new Promise((r) => setTimeout(r, durationMs));
            concurrentActive -= 1;
            return `done-${id}`;
          },
        });
      };

      const p1 = makeTask('job-1', 100);
      const p2 = makeTask('job-2', 100);
      const p3 = makeTask('job-3', 100);

      // Immediately after submitting 3 jobs to a pool with maxConcurrency = 2:
      const metrics = pool.getMetrics();
      expect(metrics.activeWorkers).toBeLessThanOrEqual(2);
      expect(metrics.queuedJobs).toBe(1);

      const results = await Promise.all([p1, p2, p3]);
      expect(results).toEqual(['done-job-1', 'done-job-2', 'done-job-3']);
      expect(peakConcurrency).toBe(2);
    });

    it('prioritizes high-priority jobs over standard queued jobs', async () => {
      const executionOrder: string[] = [];

      // Fill 2 active slots
      const blocker1 = pool.submitJob({
        id: 'blocker-1',
        targetId: 't1',
        organizationId: 'o1',
        domain: 'example.com',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 60));
          executionOrder.push('blocker-1');
        },
      });
      const blocker2 = pool.submitJob({
        id: 'blocker-2',
        targetId: 't1',
        organizationId: 'o1',
        domain: 'example.com',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 60));
          executionOrder.push('blocker-2');
        },
      });

      // Submit low priority first, then high priority
      const lowPriority = pool.submitJob({
        id: 'low-prio',
        targetId: 't1',
        organizationId: 'o1',
        domain: 'example.com',
        priority: 1,
        execute: async () => {
          executionOrder.push('low-prio');
        },
      });
      const highPriority = pool.submitJob({
        id: 'high-prio',
        targetId: 't1',
        organizationId: 'o1',
        domain: 'example.com',
        priority: 100,
        execute: async () => {
          executionOrder.push('high-prio');
        },
      });

      await Promise.all([blocker1, blocker2, lowPriority, highPriority]);

      // high-prio must execute BEFORE low-prio
      expect(executionOrder.indexOf('high-prio')).toBeLessThan(executionOrder.indexOf('low-prio'));
    });

    it('aborts long-running jobs exceeding configured timeout', async () => {
      const slowJob = pool.submitJob({
        id: 'timeout-job',
        targetId: 't1',
        organizationId: 'o1',
        domain: 'slow-target.com',
        timeoutMs: 80, // Very short timeout
        execute: async (signal) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve('finished'), 500);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Operation aborted by watchdog'));
            });
          });
        },
      });

      await expect(slowJob).rejects.toThrow(/aborted|timed out/);
      const metrics = pool.getMetrics();
      expect(metrics.timedOutJobs).toBe(1);
    });

    it('trips circuit breaker after consecutive failures and enforces cooldown', async () => {
      const failingJob = (id: string) =>
        pool.submitJob({
          id,
          targetId: 't-flaky',
          organizationId: 'o1',
          domain: 'flaky-target.org',
          execute: async () => {
            throw new Error('Connection refused by target');
          },
        });

      // Failure 1
      await expect(failingJob('fail-1')).rejects.toThrow();
      expect(pool.isCircuitOpen('flaky-target.org')).toBe(false);

      // Failure 2 (reaches threshold of 2)
      await expect(failingJob('fail-2')).rejects.toThrow();
      expect(pool.isCircuitOpen('flaky-target.org')).toBe(true);

      // Third job should immediately fail without executing
      await expect(failingJob('fail-3')).rejects.toThrow(CircuitBreakerOpenError);

      const metrics = pool.getMetrics();
      expect(metrics.openCircuits).toBe(1);
    });
  });

  // =========================================================================
  // 3. Sliding Window Rate Limiting & Proxy IP Resolution
  // =========================================================================
  describe('3. Rate Limiting Engine & Reverse Proxy Resolution', () => {
    let limiter: SlidingWindowRateLimiter;

    beforeEach(() => {
      limiter = new SlidingWindowRateLimiter(false);
    });

    afterEach(() => {
      limiter.destroy();
    });

    it('allows requests within rate limit quota and computes remaining capacity', () => {
      const key = 'test-client-1';
      const config = { maxRequests: 3, windowMs: 10_000 };

      const r1 = limiter.check(key, config);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = limiter.check(key, config);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = limiter.check(key, config);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th request must be rejected
      const r4 = limiter.check(key, config);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });

    it('supports standard named tiers (AUTH, SCANS, API_STANDARD)', () => {
      const authRes = limiter.check('auth-test-ip', 'AUTH');
      expect(authRes.limit).toBe(10);

      const scanRes = limiter.check('scan-test-ip', 'SCANS');
      expect(scanRes.limit).toBe(20);

      const apiRes = limiter.check('api-test-ip', 'API_STANDARD');
      expect(apiRes.limit).toBe(120);
    });

    describe('getClientIp Reverse Proxy IP Extraction', () => {
      it('prioritizes CF-Connecting-IP header from Cloudflare', () => {
        const headers = new Headers({
          'cf-connecting-ip': '203.0.113.195',
          'x-real-ip': '198.51.100.2',
          'x-forwarded-for': '192.0.2.1',
        });
        expect(getClientIp(headers)).toBe('203.0.113.195');
      });

      it('falls back to X-Real-IP when Cloudflare header is absent', () => {
        const headers = new Headers({
          'x-real-ip': '198.51.100.88',
          'x-forwarded-for': '192.0.2.1, 10.0.0.1',
        });
        expect(getClientIp(headers)).toBe('198.51.100.88');
      });

      it('extracts leftmost valid IP from X-Forwarded-For chain', () => {
        const headers = new Headers({
          'x-forwarded-for': '203.0.113.44, 10.0.0.1, 172.16.0.2',
        });
        expect(getClientIp(headers)).toBe('203.0.113.44');
      });

      it('safely defaults to loopback for invalid or missing IP headers', () => {
        const headers = new Headers({
          'x-forwarded-for': 'malformed-not-an-ip, still-bad',
        });
        expect(getClientIp(headers)).toBe('127.0.0.1');
      });
    });

    describe('validateRequestBodySize Protection', () => {
      it('permits payloads within the maximum byte limit', () => {
        const headers = new Headers({ 'content-length': '1048576' }); // 1MB
        const res = validateRequestBodySize(headers, 2 * 1024 * 1024);
        expect(res.valid).toBe(true);
        expect(res.length).toBe(1048576);
      });

      it('rejects payloads exceeding the configured size limit', () => {
        const headers = new Headers({ 'content-length': '5242880' }); // 5MB
        const res = validateRequestBodySize(headers, 2 * 1024 * 1024);
        expect(res.valid).toBe(false);
        expect(res.error).toContain('Payload too large');
      });
    });
  });

  // =========================================================================
  // 4. Production Observability & Sensitive Data Scrubbing
  // =========================================================================
  describe('4. Observability & Zero-Leakage Scrubbing', () => {
    it('identifies sensitive key names correctly', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('user_password')).toBe(true);
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('STRIPE_SECRET_KEY')).toBe(true);
      expect(isSensitiveKey('authorization')).toBe(true);
      expect(isSensitiveKey('session_token')).toBe(true);
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
    });

    it('scrubs sensitive fields from deeply nested objects without mutation', () => {
      const rawPayload = {
        user: {
          id: 'usr_123',
          email: 'alice@example.com',
          auth: {
            password: 'SuperSecretPassword123!',
            token: 'eyJh...jwtToken',
          },
        },
        meta: {
          apiKey: 'sk_live_998877665544332211',
          credentials: 'secret_user_credentials_blob',
          allowed: true,
        },
      };

      const scrubbed = scrubSensitiveData(rawPayload);

      // Verify original is intact
      expect(rawPayload.user.auth.password).toBe('SuperSecretPassword123!');

      // Verify scrubbed object has redacted values
      expect(scrubbed.user.id).toBe('usr_123');
      expect(scrubbed.user.email).toBe('alice@example.com');
      expect(scrubbed.user.auth.password).toBe('[REDACTED]');
      expect(scrubbed.user.auth.token).toBe('[REDACTED]');
      expect(scrubbed.meta.apiKey).toBe('[REDACTED]');
      expect(scrubbed.meta.credentials).toBe('[REDACTED]');
      expect(scrubbed.meta.allowed).toBe(true);
    });

    it('sanitizes embedded passwords and tokens inside strings and URLs', () => {
      const dbUrl = 'postgresql://admin:TopSecretPass999@db.neon.tech/zerivex_prod';
      expect(scrubString(dbUrl)).toBe(
        'postgresql://admin:[REDACTED_PASSWORD]@db.neon.tech/zerivex_prod'
      );

      const bearer = 'Authorization: Bearer secret_session_token_xyz';
      expect(scrubString(bearer)).toBe('Authorization: Bearer [REDACTED_BEARER_TOKEN]');

      const stripeKey = 'Payment token: ' + 'sk_' + 'live_' + 'abcdef123456789012345678';
      expect(scrubString(stripeKey)).toContain('sk_live_[REDACTED_KEY]');
    });

    it('StructuredLogger scrubs sensitive contexts and records structured JSON', () => {
      const testLogger = new StructuredLogger({
        serviceName: 'test-service',
        minLevel: 'DEBUG',
        captureLogs: true,
      });

      testLogger.info('User initiated scan', {
        userId: 'u_1',
        apiKey: 'secret_key_1234',
        databaseUrl: 'postgres://app:db_pass@host/db',
      });

      const logs = testLogger.getCapturedLogs();
      expect(logs.length).toBe(1);
      const entry = logs[0]!;

      expect(entry.level).toBe('INFO');
      expect(entry.service).toBe('test-service');
      expect(entry.context?.apiKey).toBe('[REDACTED]');
      expect(entry.context?.databaseUrl).toBe('[REDACTED]');
      expect(entry.context?.userId).toBe('u_1');
    });
  });

  // =========================================================================
  // 5. System Health Diagnostics & Container Probes
  // =========================================================================
  describe('5. Health Check & Container Probes', () => {
    it('getSystemHealthReport returns live diagnostic status', async () => {
      const report = await getSystemHealthReport();
      expect(['UP', 'DEGRADED', 'DOWN']).toContain(report.status);
      expect(report.database.status).toBe('CONNECTED');
      expect(report.memory.rssMb).toBeGreaterThan(0);
      expect(report.workers).toHaveProperty('activeWorkers');
      expect(report.workers).toHaveProperty('queuedJobs');
    });

    it('checkReadiness returns ready: true when database is accessible', async () => {
      const res = await checkReadiness();
      expect(res.ready).toBe(true);
    });

    it('GET /api/health returns 200 OK with system diagnostics', async () => {
      const res = await getHealth();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('database');
      expect(data).toHaveProperty('memory');
      expect(data).toHaveProperty('workers');
    });

    it('GET /api/health/live returns 200 OK liveness confirmation', async () => {
      const res = await getLive();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('alive');
      expect(data).toHaveProperty('uptime');
    });

    it('GET /api/health/ready returns 200 OK readiness status', async () => {
      const res = await getReady();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.ready).toBe(true);
    });
  });
});
