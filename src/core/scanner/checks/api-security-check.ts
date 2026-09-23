import { safeFetch } from '@/core/security/safe-http-client';
import { activeRateLimiter, circuitBreaker } from '../active-rate-limiter';
import { ScanCheck, ScanContext, RawFinding } from './types';

const SENSITIVE_API_PROBES = [
  {
    path: '/metrics',
    expectedMarkers: ['process_cpu_seconds_total', 'jvm_memory', 'http_requests_total', 'promhttp_metric_handler_errors_total', 'node_cpu_seconds_total', 'prometheus'],
    desc: 'Public Prometheus/OpenTelemetry operational metrics exposed without authentication',
  },
  {
    path: '/actuator/env',
    expectedMarkers: ['activeProfiles', 'propertySources', 'systemEnvironment'],
    desc: 'Spring Boot Actuator environment endpoint exposing internal server configuration',
  },
  {
    path: '/actuator',
    expectedMarkers: ['_links', '/actuator/health', '/actuator/beans'],
    desc: 'Spring Boot Actuator management endpoints publicly exposed',
  },
  {
    path: '/env',
    expectedMarkers: ['DATABASE_URL', 'PATH', 'PORT', 'NODE_ENV'],
    desc: 'Exposed raw environment endpoint disclosing infrastructure configuration',
  },
];

export const apiSecurityCheck: ScanCheck = {
  id: 'api-security-check',
  name: 'API Security & Shadow Endpoint Prober',
  description: 'Probes for exposed telemetry/debug endpoints and unauthenticated GraphQL introspection',
  category: 'API Security',
  requiresActiveScan: false, // Non-destructive read queries

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const baseParsed = new URL(context.targetUrl);
    const hostname = baseParsed.hostname;

    // 1. Probe for exposed debug & telemetry API endpoints
    for (const probe of SENSITIVE_API_PROBES) {
      if (circuitBreaker.isOpen(hostname)) break;

      const probeUrl = new URL(probe.path, baseParsed.origin).toString();
      try {
        await activeRateLimiter.acquireToken(hostname);
        const res = await safeFetch(probeUrl, {
          timeoutMs: 8000,
          followRedirects: false,
        });

        circuitBreaker.recordSuccess(hostname);

        if (res.statusCode === 200) {
          const bodyLower = res.body.toLowerCase();
          const matched = probe.expectedMarkers.some((m) => bodyLower.includes(m.toLowerCase()));
          if (matched) {
            findings.push({
              ruleId: 'ZX-SEC-API-001',
              title: `Exposed Sensitive API Endpoint: ${probe.path}`,
              severity: 'HIGH',
              confidence: 'HIGH',
              category: 'API Security',
              resourceEndpoint: probeUrl,
              cweId: 'CWE-200',
              owaspCategory: 'A01:2021-Broken Access Control',
              description: probe.desc,
              evidence: {
                probeUrl,
                statusCode: res.statusCode,
                contentType: res.headers['content-type'],
                sampleSnippet: res.body.substring(0, 300),
                issue: 'Unauthenticated access to internal management or telemetry interface',
              },
            });
          }
        }
      } catch (err) {
        circuitBreaker.recordFailure(hostname);
      }
    }

    // 2. Probe for GraphQL Introspection Exposure
    if (!circuitBreaker.isOpen(hostname)) {
      const graphqlUrl = new URL('/graphql', baseParsed.origin).toString();
      try {
        await activeRateLimiter.acquireToken(hostname);
        const res = await safeFetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            query: '{ __schema { types { name } } }',
          }),
          timeoutMs: 8000,
          followRedirects: false,
        });

        circuitBreaker.recordSuccess(hostname);

        if (res.statusCode === 200 && res.body.includes('__schema') && res.body.includes('types')) {
          findings.push({
            ruleId: 'ZX-SEC-API-001',
            title: 'GraphQL Schema Introspection Enabled in Production',
            severity: 'HIGH',
            confidence: 'CONFIRMED',
            category: 'API Security',
            resourceEndpoint: graphqlUrl,
            cweId: 'CWE-200',
            owaspCategory: 'A01:2021-Broken Access Control',
            description:
              'The GraphQL endpoint allows unauthenticated schema introspection. Attackers can extract the entire data graph, private queries, mutations, and database types.',
            evidence: {
              probeUrl: graphqlUrl,
              statusCode: res.statusCode,
              introspectionActive: true,
              bodySnippet: res.body.substring(0, 300),
            },
          });
        }
      } catch (err) {
        circuitBreaker.recordFailure(hostname);
      }
    }

    return findings;
  },
};
