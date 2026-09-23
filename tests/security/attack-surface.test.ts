import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { detectTechnologies } from '@/core/surface/tech-detector';
import { crawlAttackSurface } from '@/core/surface/crawler';
import { apiSecurityCheck } from '@/core/scanner/checks/api-security-check';
import { securityTxtCheck } from '@/core/scanner/checks/security-txt-check';
import { httpMethodsCheck } from '@/core/scanner/checks/http-methods-check';
import { stackTraceCheck } from '@/core/scanner/checks/stack-trace-check';
import {
  upsertDiscoveredEndpoints,
  upsertTechnologyFingerprints,
  getDiscoveredEndpointsForTarget,
  getTechnologyFingerprintsForTarget,
  getAttackSurfaceSummary,
} from '@/core/surface/surface-repository';
import { query } from '@/core/db/database';
import { createTenantTarget } from '@/core/db/repositories/tenant-repository';
import * as safeHttpClient from '@/core/security/safe-http-client';
import { defaultCircuitBreaker } from '@/core/scanner/active-rate-limiter';

describe('Phase 7: Comprehensive Security Testing & Attack Surface Engine', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let projectAId: string;
  let targetAId: string;

  beforeAll(async () => {
    // 1. Setup DB entities for tenant isolation tests
    const testSuffix = Date.now();
    await query("DELETE FROM users WHERE email LIKE 'surface-tester%@zerivex.local'");

    const userRes = await query<{ id: string }>(`
      INSERT INTO users (email, display_name, role)
      VALUES ($1, 'Surface Tester', 'USER')
      RETURNING id
    `, [`surface-tester-${testSuffix}@zerivex.local`]);
    userAId = userRes.rows[0]!.id;

    const orgARes = await query<{ id: string }>(`
      INSERT INTO organizations (name, slug, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Org Surface A', `org-surface-a-${testSuffix}`, userAId]);
    orgAId = orgARes.rows[0]!.id;

    const orgBRes = await query<{ id: string }>(`
      INSERT INTO organizations (name, slug, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Org Surface B', `org-surface-b-${testSuffix}`, userAId]);
    orgBId = orgBRes.rows[0]!.id;

    const projRes = await query<{ id: string }>(`
      INSERT INTO projects (organization_id, name, description)
      VALUES ($1, 'Surface Project A', 'Test Description')
      RETURNING id
    `, [orgAId]);
    projectAId = projRes.rows[0]!.id;

    const target = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: 'https://surface-target.local',
      verificationScope: 'EXACT_HOST',
      actorUserId: userAId,
    });
    targetAId = target.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    defaultCircuitBreaker.reset('surface-target.local');
  });

  afterAll(async () => {
    // Cleanup DB
    if (orgAId) {
      await query('DELETE FROM discovered_endpoints WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM technology_fingerprints WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM targets WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM projects WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM users WHERE id = $1', [userAId]);
    }
  });

  describe('1. Technology Detection Engine (Heuristics & Fingerprinting)', () => {
    it('detects Next.js and React from HTTP headers, scripts, and DOM markers', () => {
      const techs = detectTechnologies({
        headers: {
          'x-nextjs-cache': 'HIT',
          'x-powered-by': 'Next.js 14.2.5',
        },
        body: '<div id="__next"><script src="/_next/static/chunks/main.js"></script></div>',
      });

      const nextTech = techs.find((t) => t.name === 'Next.js');
      expect(nextTech).toBeDefined();
      expect(nextTech?.category).toBe('FRAMEWORK');
      expect(nextTech?.confidence).toBe('HIGH');
      expect(nextTech?.version).toBe('14.2.5');

      const reactTech = techs.find((t) => t.name === 'React');
      expect(reactTech).toBeDefined();
      expect(reactTech?.category).toBe('FRAMEWORK');
    });

    it('detects Express and session cookies', () => {
      const techs = detectTechnologies({
        headers: { 'x-powered-by': 'Express' },
        cookies: ['connect.sid=s%3A12345.abcdef; Path=/'],
      });

      const expressTech = techs.find((t) => t.name === 'Express');
      expect(expressTech).toBeDefined();
      expect(expressTech?.category).toBe('FRAMEWORK');
      expect(expressTech?.confidence).toBe('HIGH');
    });

    it('detects Nginx with version extraction from Server header', () => {
      const techs = detectTechnologies({
        headers: { server: 'nginx/1.24.0' },
      });

      const nginxTech = techs.find((t) => t.name === 'Nginx');
      expect(nginxTech).toBeDefined();
      expect(nginxTech?.version).toBe('1.24.0');
      expect(nginxTech?.category).toBe('SERVER');
    });

    it('detects Cloudflare and Vercel CDN/WAF infrastructure', () => {
      const techs = detectTechnologies({
        headers: {
          'cf-ray': '8c12345678-SJC',
          'x-vercel-id': 'iad1::abcdef123',
        },
      });

      expect(techs.some((t) => t.name === 'Cloudflare')).toBe(true);
      expect(techs.some((t) => t.name === 'Vercel')).toBe(true);
    });

    it('detects Tailwind CSS utility class combinations', () => {
      const techs = detectTechnologies({
        body: '<main class="flex items-center justify-between bg-slate-900 px-4 py-2 rounded-xl text-neutral-100"></main>',
      });

      const tailwind = techs.find((t) => t.name === 'Tailwind CSS');
      expect(tailwind).toBeDefined();
      expect(tailwind?.category).toBe('AI_TOOLING');
    });

    it('detects Supabase client indicators', () => {
      const techs = detectTechnologies({
        body: 'import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js"',
        cookies: ['sb-testproject-auth-token=eyJ...'],
      });

      const supabase = techs.find((t) => t.name === 'Supabase');
      expect(supabase).toBeDefined();
      expect(supabase?.category).toBe('DATABASE');
    });
  });

  describe('2. Security Check Modules (Phase 7 Specifications)', () => {
    it('API Security: detects exposed metrics and unauthenticated GraphQL introspection', async () => {
      vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        if (url.includes('/metrics')) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/plain; version=0.0.4' },
            body: '# HELP process_cpu_seconds_total Total user and system CPU time\nprocess_cpu_seconds_total 12.4\n',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }
        if (url.includes('/graphql')) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ data: { __schema: { types: [{ name: 'User' }, { name: 'Query' }] } } }),
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }
        return {
          statusCode: 404,
          headers: {},
          body: 'Not Found',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await apiSecurityCheck.run({
        targetUrl: 'https://surface-target.local',
        hostname: 'surface-target.local',
        scanMode: 'PUBLIC_PASSIVE',
        organizationId: orgAId,
        targetId: targetAId,
      });

      const metricsFinding = findings.find((f) => f.title.includes('/metrics'));
      expect(metricsFinding).toBeDefined();
      expect(metricsFinding?.ruleId).toBe('ZX-SEC-API-001');
      expect(metricsFinding?.severity).toBe('HIGH');

      const graphqlFinding = findings.find((f) => f.title.includes('GraphQL Schema Introspection'));
      expect(graphqlFinding).toBeDefined();
      expect(graphqlFinding?.ruleId).toBe('ZX-SEC-API-001');
      expect(graphqlFinding?.confidence).toBe('CONFIRMED');
    });

    it('security.txt: validates RFC 9116 compliant security.txt', async () => {
      vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        if (url.includes('/.well-known/security.txt')) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/plain' },
            body: 'Contact: mailto:security@example.com\nExpires: 2028-12-31T23:59:59.000Z\nPreferred-Languages: en\n',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }
        return {
          statusCode: 404,
          headers: {},
          body: 'Not Found',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await securityTxtCheck.run({
        targetUrl: 'https://surface-target.local',
        hostname: 'surface-target.local',
        scanMode: 'PUBLIC_PASSIVE',
        organizationId: orgAId,
        targetId: targetAId,
      });

      const secTxtFinding = findings.find((f) => f.ruleId === 'ZX-SEC-SECTXT-001');
      expect(secTxtFinding).toBeUndefined();
    });

    it('security.txt: flags missing security.txt when endpoint returns 404', async () => {
      vi.spyOn(safeHttpClient, 'safeFetch').mockResolvedValue({
        statusCode: 404,
        headers: {},
        body: 'Not Found',
        finalUrl: 'https://surface-target.local/.well-known/security.txt',
        pinnedIp: '93.184.216.34',
      });

      const findings = await securityTxtCheck.run({
        targetUrl: 'https://surface-target.local',
        hostname: 'surface-target.local',
        scanMode: 'PUBLIC_PASSIVE',
        organizationId: orgAId,
        targetId: targetAId,
      });

      const missingFinding = findings.find((f) => f.ruleId === 'ZX-SEC-SECTXT-001');
      expect(missingFinding).toBeDefined();
      expect(missingFinding?.severity).toBe('LOW');
    });

    it('HTTP Methods: detects HTTP TRACE (Cross-Site Tracing) when enabled', async () => {
      vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url, options) => {
        if (options?.method === 'TRACE') {
          return {
            statusCode: 200,
            headers: { 'content-type': 'message/http' },
            body: 'TRACE / HTTP/1.1\r\nX-Zerivex-Trace-Test: canary-trace-probe\r\n',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }
        return {
          statusCode: 200,
          headers: { allow: 'GET, POST, OPTIONS, TRACE' },
          body: '',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await httpMethodsCheck.run({
        targetUrl: 'https://surface-target.local',
        hostname: 'surface-target.local',
        scanMode: 'PUBLIC_PASSIVE',
        organizationId: orgAId,
        targetId: targetAId,
      });

      const traceFinding = findings.find((f) => f.ruleId === 'ZX-SEC-VERB-001');
      expect(traceFinding).toBeDefined();
      expect(traceFinding?.severity).toBe('MEDIUM');
      expect(traceFinding?.title).toContain('HTTP TRACE Method Enabled');
    });

    it('Stack Trace Prober: detects detailed Node.js stack trace leakage', async () => {
      vi.spyOn(safeHttpClient, 'safeFetch').mockResolvedValue({
        statusCode: 500,
        headers: { 'content-type': 'text/html' },
        body: '<html><body><h1>Error</h1><pre>TypeError: Cannot read properties of undefined\n    at Object.<anonymous> (/var/app/node_modules/pg/lib/client.js:14:12)</pre></body></html>',
        finalUrl: 'https://surface-target.local',
        pinnedIp: '93.184.216.34',
      });

      const findings = await stackTraceCheck.run({
        targetUrl: 'https://surface-target.local',
        hostname: 'surface-target.local',
        scanMode: 'PUBLIC_PASSIVE',
        organizationId: orgAId,
        targetId: targetAId,
      });

      const stackFinding = findings.find((f) => f.ruleId === 'ZX-SEC-STACK-001');
      expect(stackFinding).toBeDefined();
      expect(stackFinding?.severity).toBe('HIGH');
      expect(stackFinding?.confidence).toBe('CONFIRMED');
    });

    it('Stack Trace Prober: does not flag safe generic error messages', async () => {
      vi.spyOn(safeHttpClient, 'safeFetch').mockResolvedValue({
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Internal Server Error', referenceId: 'err-123' }),
        finalUrl: 'https://surface-target.local',
        pinnedIp: '93.184.216.34',
      });

      const findings = await stackTraceCheck.run({
        targetUrl: 'https://surface-target.local',
        hostname: 'surface-target.local',
        scanMode: 'PUBLIC_PASSIVE',
        organizationId: orgAId,
        targetId: targetAId,
      });

      const stackFinding = findings.find((f) => f.ruleId === 'ZX-SEC-STACK-001');
      expect(stackFinding).toBeUndefined();
    });
  });

  describe('3. Attack Surface Repository & Multi-Tenant IDOR Defenses', () => {
    it('upserts and retrieves discovered endpoints for Org A', async () => {
      await upsertDiscoveredEndpoints(orgAId, targetAId, null, [
        {
          url: 'https://surface-target.local/api/users',
          path: '/api/users',
          httpMethod: 'GET',
          parameters: [{ name: 'limit', in: 'query' }, { name: 'page', in: 'query' }],
          statusCode: 200,
          contentType: 'application/json',
          discoverySource: 'CRAWLER',
          responseTimeMs: 45,
        },
        {
          url: 'https://surface-target.local/api/users',
          path: '/api/users',
          httpMethod: 'POST',
          parameters: [{ name: 'email', in: 'body' }, { name: 'name', in: 'body' }],
          statusCode: 201,
          contentType: 'application/json',
          discoverySource: 'CRAWLER',
          responseTimeMs: 90,
        },
      ]);

      const eps = await getDiscoveredEndpointsForTarget(orgAId, targetAId);
      expect(eps.length).toBe(2);
      expect(eps.some((e) => e.httpMethod === 'GET' && e.path === '/api/users')).toBe(true);
      expect(eps.some((e) => e.httpMethod === 'POST' && e.path === '/api/users')).toBe(true);
    });

    it('upserts and retrieves technology fingerprints for Org A', async () => {
      await upsertTechnologyFingerprints(orgAId, targetAId, null, [
        {
          category: 'FRAMEWORK',
          name: 'Next.js',
          version: '14.2.5',
          confidence: 'HIGH',
          matchedIndicators: ['HTTP Header: x-nextjs-cache', 'Static asset path: /_next/static/'],
        },
        {
          category: 'SERVER',
          name: 'Nginx',
          version: '1.24.0',
          confidence: 'HIGH',
          matchedIndicators: ['Server header: nginx/1.24.0'],
        },
      ]);

      const techs = await getTechnologyFingerprintsForTarget(orgAId, targetAId);
      expect(techs.length).toBe(2);
      expect(techs.some((t) => t.name === 'Next.js' && t.version === '14.2.5')).toBe(true);
      expect(techs.some((t) => t.name === 'Nginx')).toBe(true);
    });

    it('enforces IDOR isolation: Org B CANNOT read Org A attack surface', async () => {
      const orgBEps = await getDiscoveredEndpointsForTarget(orgBId, targetAId);
      expect(orgBEps.length).toBe(0);

      const orgBTechs = await getTechnologyFingerprintsForTarget(orgBId, targetAId);
      expect(orgBTechs.length).toBe(0);

      const orgBSummary = await getAttackSurfaceSummary(orgBId, targetAId);
      expect(orgBSummary.totalEndpoints).toBe(0);
      expect(orgBSummary.totalTechnologies).toBe(0);
    });

    it('generates accurate attack surface summary for Org A', async () => {
      const summary = await getAttackSurfaceSummary(orgAId, targetAId);
      expect(summary.totalEndpoints).toBe(2);
      expect(summary.totalTechnologies).toBe(2);
      expect(summary.methodsBreakdown['GET']).toBe(1);
      expect(summary.methodsBreakdown['POST']).toBe(1);
      expect(summary.sourcesBreakdown['CRAWLER']).toBe(2);
      expect(summary.technologiesByCategory['FRAMEWORK']).toHaveLength(1);
      expect(summary.technologiesByCategory['SERVER']).toHaveLength(1);
    });
  });

  describe('4. Attack Surface Crawler & Boundary Controls', () => {
    it('crawls links, extracts form parameters, and strictly rejects off-domain URLs', async () => {
      vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        if (url.includes('/robots.txt')) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/plain' },
            body: 'User-agent: *\nDisallow: /admin\nDisallow: /secret-api\n',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }
        if (url.endsWith('/')) {
          return {
            statusCode: 200,
            headers: {
              'content-type': 'text/html',
              'server': 'nginx/1.24.0',
              'x-nextjs-cache': 'HIT',
            },
            body: `
              <html>
              <body>
                <a href="/dashboard">Dashboard</a>
                <a href="https://external-hacker.com/malicious">Off-Domain</a>
                <a href="https://surface-target.local/search?q=security&page=1">Search Page</a>
                <form action="/auth/login" method="POST">
                  <input name="email" type="text" />
                  <input name="password" type="password" />
                </form>
              </body>
              </html>
            `,
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }
        return {
          statusCode: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html><body>Clean Page</body></html>',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const result = await crawlAttackSurface('https://surface-target.local/', {
        maxDepth: 2,
        maxPages: 10,
      });

      // 1. Check endpoints discovered
      expect(result.endpoints.length).toBeGreaterThanOrEqual(4);

      // 2. Verified same-host constraint: zero external domains
      const hasOffDomain = result.endpoints.some((e) => e.url.includes('external-hacker.com'));
      expect(hasOffDomain).toBe(false);

      // 3. Form parameter extraction
      const loginForm = result.endpoints.find((e) => e.path === '/auth/login' && e.httpMethod === 'POST');
      expect(loginForm).toBeDefined();
      expect(loginForm?.parameters.some((p) => p.name === 'email')).toBe(true);
      expect(loginForm?.parameters.some((p) => p.name === 'password')).toBe(true);

      // 4. URL query parameters
      const searchEp = result.endpoints.find((e) => e.path === '/search');
      expect(searchEp).toBeDefined();
      expect(searchEp?.parameters.some((p) => p.name === 'q')).toBe(true);

      // 5. Robots.txt disallow parsing
      const adminEp = result.endpoints.find((e) => e.path === '/admin');
      expect(adminEp).toBeDefined();
      expect(adminEp?.discoverySource).toBe('ROBOTS_TXT');

      // 6. Technology detection integration
      expect(result.technologies.some((t) => t.name === 'Next.js')).toBe(true);
      expect(result.technologies.some((t) => t.name === 'Nginx')).toBe(true);
    });
  });
});
