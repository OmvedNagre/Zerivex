import { safeFetch } from '@/core/security/safe-http-client';
import { activeRateLimiter, circuitBreaker } from '../active-rate-limiter';
import { ScanCheck, ScanContext, RawFinding } from './types';

export const httpMethodsCheck: ScanCheck = {
  id: 'http-methods-check',
  name: 'HTTP Verb Tampering & Insecure Methods Prober',
  description: 'Probes for dangerous HTTP methods such as TRACE (Cross-Site Tracing) and insecure verb handling',
  category: 'Access Control',
  requiresActiveScan: false, // Non-destructive protocol checks

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const baseParsed = new URL(context.targetUrl);
    const hostname = baseParsed.hostname;

    if (circuitBreaker.isOpen(hostname)) return findings;

    // 1. Probe TRACE Method (Cross-Site Tracing - XST vulnerability)
    try {
      await activeRateLimiter.acquireToken(hostname);
      const traceRes = await safeFetch(context.targetUrl, {
        method: 'TRACE',
        headers: {
          'X-Zerivex-Trace-Test': 'canary-trace-probe',
        },
        timeoutMs: 8000,
        followRedirects: false,
      });

      circuitBreaker.recordSuccess(hostname);

      if (traceRes.statusCode === 200 && (traceRes.body.includes('canary-trace-probe') || traceRes.body.includes('TRACE /'))) {
        findings.push({
          ruleId: 'ZX-SEC-VERB-001',
          title: 'HTTP TRACE Method Enabled (Cross-Site Tracing / XST Risk)',
          severity: 'MEDIUM',
          confidence: 'CONFIRMED',
          category: 'HTTP Protocol',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-698',
          owaspCategory: 'A05:2021-Security Misconfiguration',
          description:
            'The web server supports the HTTP TRACE method and echoes back request headers. This enables Cross-Site Tracing (XST) attacks, which can allow malicious scripts to bypass HttpOnly cookie protections.',
          evidence: {
            method: 'TRACE',
            statusCode: traceRes.statusCode,
            reflectedCanary: 'canary-trace-probe',
            responseSnippet: traceRes.body.substring(0, 300),
          },
        });
      }
    } catch (err) {
      circuitBreaker.recordFailure(hostname);
    }

    // 2. Probe OPTIONS method to evaluate allowed verbs
    if (!circuitBreaker.isOpen(hostname)) {
      try {
        await activeRateLimiter.acquireToken(hostname);
        const optionsRes = await safeFetch(context.targetUrl, {
          method: 'OPTIONS',
          timeoutMs: 8000,
          followRedirects: false,
        });

        circuitBreaker.recordSuccess(hostname);

        const allowHeader = (optionsRes.headers.allow as string) || '';
        if (allowHeader) {
          const methods = allowHeader.split(',').map((m) => m.trim().toUpperCase());
          const dangerousMethods = methods.filter((m) => ['TRACE', 'CONNECT'].includes(m));

          if (dangerousMethods.length > 0 && !findings.some((f) => f.ruleId === 'ZX-SEC-VERB-001')) {
            findings.push({
              ruleId: 'ZX-SEC-VERB-001',
              title: `Dangerous HTTP Methods Advertised in Allow Header: ${dangerousMethods.join(', ')}`,
              severity: 'LOW',
              confidence: 'HIGH',
              category: 'HTTP Protocol',
              resourceEndpoint: context.targetUrl,
              cweId: 'CWE-650',
              owaspCategory: 'A05:2021-Security Misconfiguration',
              description: `The server advertises support for high-risk HTTP methods (${dangerousMethods.join(', ')}) in its OPTIONS Allow header.`,
              evidence: {
                allowHeader,
                dangerousMethods,
                statusCode: optionsRes.statusCode,
              },
            });
          }
        }
      } catch (err) {
        circuitBreaker.recordFailure(hostname);
      }
    }

    return findings;
  },
};
