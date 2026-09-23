import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';
import { defaultRateLimiter, defaultCircuitBreaker, CircuitBreakerOpenError } from '../active-rate-limiter';

const REDIRECT_TARGET = 'https://example.com/zerivex-redirect-canary';
const PROTO_RELATIVE_TARGET = '//example.com/zerivex-redirect-canary';

const REDIRECT_PARAMS = [
  'redirect',
  'url',
  'next',
  'return_to',
  'return',
  'target',
  'dest',
  'continue',
  'goto',
  'out',
];

export const openRedirectCheck: ScanCheck = {
  id: 'check-open-redirect',
  name: 'Active Open Redirect Prober',
  description: 'Probes common navigation and redirection parameters with external domain canaries to verify whether the application permits unvalidated external redirects.',
  category: 'Broken Access Control',
  requiresActiveScan: true,

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    if (context.scanMode !== 'VERIFIED_ACTIVE') {
      return findings;
    }

    const parsed = new URL(context.targetUrl);
    const existingParams = Array.from(parsed.searchParams.keys());
    const candidateParams = existingParams.length > 0 ? existingParams : REDIRECT_PARAMS;

    const payloads = [REDIRECT_TARGET, PROTO_RELATIVE_TARGET];

    for (const param of candidateParams) {
      if (defaultCircuitBreaker.isOpen(context.hostname)) break;

      let vulnFound = false;
      for (const payload of payloads) {
        if (defaultCircuitBreaker.isOpen(context.hostname)) break;

        const testUrl = new URL(context.targetUrl);
        testUrl.searchParams.set(param, payload);

        try {
          await defaultRateLimiter.acquire(context.hostname);
          const res = await safeFetch(testUrl.toString(), {
            method: 'GET',
            followRedirects: false,
            timeoutMs: 8000,
          });

          // Check HTTP 3xx Location header
          const isRedirectStatus = [301, 302, 303, 307, 308].includes(res.statusCode);
          const locationHeader = res.headers.location;

          if (isRedirectStatus && locationHeader) {
            const locStr = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;

            // Verify if redirect points to external domain example.com
            const isExternalRedirect =
              locStr.startsWith('https://example.com') ||
              locStr.startsWith('http://example.com') ||
              locStr.startsWith('//example.com') ||
              locStr.includes('example.com/zerivex-redirect-canary');

            // Ensure it's not a relative path on the same host (e.g., https://originalhost.com/example.com)
            let isDifferentHost = false;
            try {
              const parsedLoc = new URL(locStr, context.targetUrl);
              isDifferentHost = parsedLoc.hostname === 'example.com' && parsedLoc.hostname !== context.hostname;
            } catch {
              isDifferentHost = isExternalRedirect;
            }

            if (isDifferentHost) {
              findings.push({
                ruleId: 'ZX-ACT-REDIR-001',
                title: `Unvalidated Open Redirect in Parameter "${param}"`,
                severity: 'MEDIUM',
                confidence: 'CONFIRMED',
                category: 'Broken Access Control',
                resourceEndpoint: testUrl.toString(),
                cweId: 'CWE-601',
                owaspCategory: 'A01:2021-Broken Access Control',
                description: `The application returned an HTTP ${res.statusCode} redirect to an untrusted external domain ("${locStr}") when supplied with parameter "${param}". Attackers can exploit this to construct believable phishing URLs leveraging your trusted domain.`,
                remediation: `Validate redirect destinations against a strict allowlist of permitted domain names or relative paths (e.g. paths starting with '/' but not '//'). Reject or sanitize any redirect URL pointing to external hosts.`,
                evidence: {
                  parameter: param,
                  probePayload: payload,
                  responseStatusCode: res.statusCode,
                  locationHeader: locStr,
                },
              });
              vulnFound = true;
              break;
            }
          }

          // Check client-side HTML meta refresh
          if (res.body.includes('http-equiv="refresh"') && res.body.includes('example.com/zerivex-redirect-canary')) {
            findings.push({
              ruleId: 'ZX-ACT-REDIR-001',
              title: `Unvalidated Open Redirect via Meta Refresh in Parameter "${param}"`,
              severity: 'MEDIUM',
              confidence: 'CONFIRMED',
              category: 'Broken Access Control',
              resourceEndpoint: testUrl.toString(),
              cweId: 'CWE-601',
              owaspCategory: 'A01:2021-Broken Access Control',
              description: `The application rendered an HTML <meta http-equiv="refresh"> redirecting the user to an untrusted external destination supplied in parameter "${param}".`,
              remediation: `Validate redirect destinations against an explicit whitelist of internal relative paths. Never render arbitrary user input into redirect targets.`,
              evidence: {
                parameter: param,
                probePayload: payload,
                responseStatusCode: res.statusCode,
                metaSnippet: res.body.substring(
                  Math.max(0, res.body.indexOf('http-equiv="refresh"') - 20),
                  Math.min(res.body.length, res.body.indexOf('http-equiv="refresh"') + 120)
                ),
              },
            });
            vulnFound = true;
            break;
          }

          if (res.statusCode >= 500) {
            defaultCircuitBreaker.recordFailure(context.hostname);
          } else {
            defaultCircuitBreaker.recordSuccess(context.hostname);
          }
        } catch (err) {
          if (err instanceof CircuitBreakerOpenError) {
            break;
          }
          defaultCircuitBreaker.recordFailure(context.hostname);
        }
      }

      if (vulnFound) {
        defaultCircuitBreaker.recordSuccess(context.hostname);
      }
    }

    return findings;
  },
};
