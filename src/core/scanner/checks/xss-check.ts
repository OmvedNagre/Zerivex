import crypto from 'crypto';
import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';
import { defaultRateLimiter, defaultCircuitBreaker, CircuitBreakerOpenError } from '../active-rate-limiter';

export const xssCheck: ScanCheck = {
  id: 'check-xss',
  name: 'Active Reflected Cross-Site Scripting (XSS) Prober',
  description: 'Injects high-entropy cryptographic canary payloads into query parameters to verify if untrusted input is reflected into HTML responses without contextual escaping.',
  category: 'Injection',
  requiresActiveScan: true,

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    if (context.scanMode !== 'VERIFIED_ACTIVE') {
      return findings;
    }

    const parsed = new URL(context.targetUrl);
    const existingParams = Array.from(parsed.searchParams.keys());
    const candidateParams = existingParams.length > 0 ? existingParams : ['q', 'search', 'query', 'keyword', 's', 'ref', 'name', 'msg'];

    for (const param of candidateParams) {
      if (defaultCircuitBreaker.isOpen(context.hostname)) break;

      // Generate a unique, cryptographically random canary token for this probe
      const canaryId = crypto.randomBytes(6).toString('hex');
      const canaryToken = `zx${canaryId}`;
      const probePayload = `"><script>/*${canaryToken}*/</script>`;

      const testUrl = new URL(context.targetUrl);
      testUrl.searchParams.set(param, probePayload);

      try {
        await defaultRateLimiter.acquire(context.hostname);
        const res = await safeFetch(testUrl.toString(), {
          method: 'GET',
          timeoutMs: 8000,
        });

        const contentType = (res.headers['content-type'] as string) || '';
        const isHtmlContent = contentType.includes('text/html') ||
          res.body.includes('<!DOCTYPE') ||
          res.body.includes('<html') ||
          res.body.includes('<body');

        // Check if the canary is reflected
        if (isHtmlContent && res.body.includes(canaryToken)) {
          // Strictly confirm unescaped reflection:
          // Must contain unescaped `<script>/*${canaryToken}*/</script>` or unescaped `"><script>`
          const unescapedExact = res.body.includes(`<script>/*${canaryToken}*/</script>`);
          const unescapedTag = res.body.includes(`><script`) && res.body.includes(canaryToken);

          // If safely escaped (e.g. &lt;script&gt; or &quot;), do NOT flag
          const isEntityEscaped = res.body.includes(`&lt;script&gt;/*${canaryToken}*/&lt;/script&gt;`) ||
            (res.body.includes('&lt;') && !unescapedExact);

          if ((unescapedExact || unescapedTag) && !isEntityEscaped) {
            const index = res.body.indexOf(canaryToken);
            const snippet = res.body.substring(
              Math.max(0, index - 60),
              Math.min(res.body.length, index + 80)
            );

            findings.push({
              ruleId: 'ZX-ACT-XSS-001',
              title: `Reflected Cross-Site Scripting (XSS) in Parameter "${param}"`,
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              category: 'Injection',
              resourceEndpoint: testUrl.toString(),
              cweId: 'CWE-79',
              owaspCategory: 'A03:2021-Injection',
              description: `User input provided in parameter "${param}" is reflected directly into HTML output without contextual HTML entity encoding. An attacker can craft a link that executes arbitrary JavaScript in the victim's browser session.`,
              remediation: `Contextually encode all user-controlled data before rendering into HTML templates or DOM nodes (e.g. use framework auto-escaping in React/Next.js JSX, textContent, or sanitization libraries like DOMPurify). Ensure strict Content-Security-Policy (CSP) headers are deployed.`,
              evidence: {
                parameter: param,
                probePayload,
                canaryToken,
                unescapedSnippet: snippet,
                contentType,
                statusCode: res.statusCode,
              },
            });

            // Finding confirmed for this parameter, move to next
            defaultCircuitBreaker.recordSuccess(context.hostname);
            continue;
          }
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

    return findings;
  },
};
