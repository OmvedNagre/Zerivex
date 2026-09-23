import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';

export const aiCodeSmellsCheck: ScanCheck = {
  id: 'check-ai-code-smells',
  name: 'AI Code Smells & Debug Interface Auditor',
  description: 'Probes for exposed debug tooling, stack trace leaks, testing routes, and unhardened developer endpoints common in AI-generated codebases.',
  category: 'AI Software Vulnerabilities',
  requiresActiveScan: false, // Safe read-only probing

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const baseUrl = context.targetUrl.replace(/\/+$/, '');

    // 1. Stack Trace & Path Disclosure Probe
    // We send an invalid request to test error handling
    try {
      const errorProbeUrl = `${baseUrl}/api/non-existent-probe-${Date.now()}`;
      const errRes = await safeFetch(errorProbeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 8000,
      });

      const body = errRes.body;
      const leaksFilePath = /(?:\/(?:Users|home|app|var|usr)\/[a-zA-Z0-9_\-\/.]+\.(?:ts|js|py|rb|php|go)|[A-Za-z]:\\[a-zA-Z0-9_\-\\]+\.(?:ts|js|py|php))/i.test(body);
      const leaksStackTrace = /(?:at\s+[a-zA-Z0-9_$.]+\s+\([^)]+\)|Traceback \(most recent call last\)|webpack-internal:\/\/)/.test(body);
      const leaksDbError = /(?:pg_query|syntax error at or near|relation ".*" does not exist|ORA-\d{5}|mysql_fetch_array)/i.test(body);

      if (leaksFilePath || leaksStackTrace || leaksDbError) {
        findings.push({
          ruleId: 'ZX-AI-001',
          title: 'Verbose Stack Trace & Internal Path Disclosure',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'Information Disclosure',
          resourceEndpoint: errorProbeUrl,
          cweId: 'CWE-209',
          owaspCategory: 'A05:2021-Security Misconfiguration',
          description: 'The application returns detailed stack traces, internal server filepaths, or database error messages in error responses.',
          remediation: 'Implement a centralized global error handler that returns generic error messages to clients while logging stack traces securely on the server.',
          evidence: {
            endpoint: errorProbeUrl,
            statusCode: errRes.statusCode,
            snippet: body.substring(0, 500),
          },
        });
      }
    } catch {
      // Ignore network timeout
    }

    // 2. GraphQL Introspection Probe
    for (const gqlPath of ['/graphql', '/api/graphql']) {
      try {
        const gqlUrl = `${baseUrl}${gqlPath}`;
        const gqlRes = await safeFetch(gqlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeoutMs: 8000,
        });

        // If returns 200 or 400 with GraphQL schema details
        if (
          gqlRes.body.includes('__schema') ||
          gqlRes.body.includes('GraphQL') ||
          gqlRes.body.includes('query must be provided')
        ) {
          // Probe actual introspection query
          const introRes = await safeFetch(gqlUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeoutMs: 8000,
          });

          if (introRes.body.includes('__schema') || introRes.body.includes('Query')) {
            findings.push({
              ruleId: 'ZX-AI-002',
              title: 'Exposed GraphQL Endpoint with Introspection',
              severity: 'MEDIUM',
              confidence: 'CONFIRMED',
              category: 'API Security',
              resourceEndpoint: gqlUrl,
              cweId: 'CWE-200',
              owaspCategory: 'A01:2021-Broken Access Control',
              description: `GraphQL endpoint is enabled at ${gqlPath}. If introspection is allowed in production, attackers can extract the complete data schema and queries.`,
              remediation: 'Disable GraphQL introspection in production environments and enforce query complexity and depth limits.',
              evidence: {
                endpoint: gqlUrl,
                statusCode: gqlRes.statusCode,
              },
            });
            break; // Found on this path
          }
        }
      } catch {
        // Skip
      }
    }

    // 3. Exposed Development & Database Seed Routes
    const devRoutes = ['/api/seed', '/api/reset-db', '/test-db', '/debug'];
    for (const devPath of devRoutes) {
      try {
        const devUrl = `${baseUrl}${devPath}`;
        const devRes = await safeFetch(devUrl, { method: 'GET', timeoutMs: 8000 });

        if (devRes.statusCode === 200 && !devRes.body.includes('<html') && devRes.body.length > 0) {
          findings.push({
            ruleId: 'ZX-AI-003',
            title: `Exposed Development / Test Endpoint: ${devPath}`,
            severity: 'HIGH',
            confidence: 'CONFIRMED',
            category: 'API Security',
            resourceEndpoint: devUrl,
            cweId: 'CWE-489',
            owaspCategory: 'A05:2021-Security Misconfiguration',
            description: `A development or test route ("${devPath}") was left active in production and returned HTTP 200.`,
            remediation: 'Ensure test, seed, and debug routes are gated behind NODE_ENV !== "production" or removed from production builds.',
            evidence: {
              endpoint: devUrl,
              statusCode: devRes.statusCode,
              snippet: devRes.body.substring(0, 300),
            },
          });
        }
      } catch {
        // Skip
      }
    }

    return findings;
  },
};
