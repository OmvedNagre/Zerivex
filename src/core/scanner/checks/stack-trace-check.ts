import { safeFetch } from '@/core/security/safe-http-client';
import { activeRateLimiter, circuitBreaker } from '../active-rate-limiter';
import { ScanCheck, ScanContext, RawFinding } from './types';

const STACK_TRACE_PATTERNS = [
  /\b(?:node_modules[\\/]|node:internal[\\/]|at\s+(?:async\s+)?[\w$.]+?\s*\([^)]+:\d+:\d+\))/,
  /\b(?:TypeError|ReferenceError|SyntaxError|RangeError):\s+/,
  /\bTraceback\s*\(most\s+recent\s+call\s+last\):/i,
  /\b(?:webpack-internal:\/\/\/|next\/dist\/server\/)/,
  /\b(?:SQLException|QueryFailedError|PostgresError|MongoServerError):/i,
  /\bat\s+[a-zA-Z0-9_$.]+\s*\([a-zA-Z0-9_./\\-]+:\d+:\d+\)/,
];

export const stackTraceCheck: ScanCheck = {
  id: 'stack-trace-check',
  name: 'Stack Trace & Error Disclosure Prober',
  description: 'Probes endpoints for verbose production stack traces and internal framework exception leakage',
  category: 'Information Disclosure',
  requiresActiveScan: false, // Non-destructive read probes

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const baseParsed = new URL(context.targetUrl);
    const hostname = baseParsed.hostname;

    // Test probes:
    // 1. Invalid JSON to base API / target URL
    // 2. Synthetic path with invalid encoding to provoke server-side error handler
    const probes: Array<{
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
      desc: string;
    }> = [
      {
        url: context.targetUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid_json_payload: [unclosed',
        desc: 'Malformed JSON payload probe',
      },
      {
        url: new URL('/__zerivex_error_probe_404__', baseParsed.origin).toString(),
        method: 'GET',
        headers: {},
        desc: 'Non-existent route error handler probe',
      },
    ];

    for (const probe of probes) {
      if (circuitBreaker.isOpen(hostname)) break;

      try {
        await activeRateLimiter.acquireToken(hostname);
        const res = await safeFetch(probe.url, {
          method: probe.method,
          headers: probe.headers,
          body: probe.body,
          timeoutMs: 8000,
          followRedirects: false,
        });

        circuitBreaker.recordSuccess(hostname);

        // Check if response leaks stack trace patterns
        const body = res.body;
        for (const pattern of STACK_TRACE_PATTERNS) {
          const match = pattern.exec(body);
          if (match) {
            findings.push({
              ruleId: 'ZX-SEC-STACK-001',
              title: 'Server Stack Trace & Internal Exception Disclosed in Error Response',
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              category: 'Information Disclosure',
              resourceEndpoint: probe.url,
              cweId: 'CWE-209',
              owaspCategory: 'A05:2021-Security Misconfiguration',
              description:
                'The application returned a response containing a raw server-side stack trace or internal exception dump. This discloses internal file paths, framework versions, module dependencies, and code structure to unauthorized users.',
              evidence: {
                probeUrl: probe.url,
                method: probe.method,
                statusCode: res.statusCode,
                matchedPattern: pattern.source,
                leakedSnippet: body.substring(Math.max(0, match.index - 50), match.index + 200),
              },
            });
            return findings; // Found stack trace, no need to duplicate
          }
        }
      } catch (err) {
        circuitBreaker.recordFailure(hostname);
      }
    }

    return findings;
  },
};
