import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';

export const corsCheck: ScanCheck = {
  id: 'check-cors',
  name: 'CORS Misconfiguration & Origin Reflection Prober',
  description: 'Probes Cross-Origin Resource Sharing (CORS) configurations for wildcard allowances, credential exposure, and arbitrary origin reflection.',
  category: 'Access Control',
  requiresActiveScan: false, // Safe origin testing header checks

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const untrustedOrigin = 'https://attacker.zerivex-security-test.com';

    // 1. Probe with untrusted external origin
    try {
      const res = await safeFetch(context.targetUrl, {
        method: 'GET',
        headers: {
          Origin: untrustedOrigin,
          'Access-Control-Request-Method': 'GET',
        },
        timeoutMs: 10000,
      });

      const allowOrigin = res.headers['access-control-allow-origin'];
      const allowCreds = res.headers['access-control-allow-credentials'];
      const allowOriginStr = Array.isArray(allowOrigin) ? allowOrigin[0] : allowOrigin;
      const allowCredsBool = allowCreds === 'true' || (Array.isArray(allowCreds) && allowCreds[0] === 'true');

      // Test 1: Wildcard Origin with Credentials (Invalid / Dangerous)
      if (allowOriginStr === '*' && allowCredsBool) {
        findings.push({
          ruleId: 'ZX-CORS-001',
          title: 'CORS Wildcard Allowed with Credentials',
          severity: 'CRITICAL',
          confidence: 'CONFIRMED',
          category: 'CORS Misconfiguration',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-942',
          owaspCategory: 'A01:2021-Broken Access Control',
          description: 'The server returns "Access-Control-Allow-Origin: *" combined with "Access-Control-Allow-Credentials: true", allowing arbitrary origins to read authenticated responses.',
          remediation: 'Restrict Access-Control-Allow-Origin to an explicit allowlist of trusted origins, and never combine wildcard origins with credentials.',
          evidence: {
            originSent: untrustedOrigin,
            accessControlAllowOrigin: allowOriginStr,
            accessControlAllowCredentials: allowCreds,
          },
        });
      }

      // Test 2: Arbitrary Origin Reflection with Credentials
      if (allowOriginStr === untrustedOrigin && allowCredsBool) {
        findings.push({
          ruleId: 'ZX-CORS-002',
          title: 'Arbitrary CORS Origin Reflection with Credentials',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'CORS Misconfiguration',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-942',
          owaspCategory: 'A01:2021-Broken Access Control',
          description: `The application reflects arbitrary Origin headers ("${untrustedOrigin}") and authorizes credentialed requests, allowing cross-origin data theft.`,
          remediation: 'Validate incoming Origin headers against an explicit, strictly validated allowlist of authorized partner domains.',
          evidence: {
            originSent: untrustedOrigin,
            reflectedAllowOrigin: allowOriginStr,
            accessControlAllowCredentials: allowCreds,
          },
        });
      } else if (allowOriginStr === untrustedOrigin && !allowCredsBool) {
        findings.push({
          ruleId: 'ZX-CORS-003',
          title: 'Permissive Arbitrary Origin Reflection',
          severity: 'MEDIUM',
          confidence: 'CONFIRMED',
          category: 'CORS Misconfiguration',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-942',
          owaspCategory: 'A01:2021-Broken Access Control',
          description: `The application reflects the supplied Origin header ("${untrustedOrigin}") without checking an allowlist.`,
          remediation: 'Maintain an explicit allowlist for CORS origins rather than reflecting arbitrary incoming request origins.',
          evidence: {
            originSent: untrustedOrigin,
            reflectedAllowOrigin: allowOriginStr,
          },
        });
      }
    } catch {
      // Ignore network timeout
    }

    // 2. Probe with Null Origin (Sandbox bypass test)
    try {
      const resNull = await safeFetch(context.targetUrl, {
        method: 'GET',
        headers: { Origin: 'null' },
        timeoutMs: 10000,
      });

      const nullAllowOrigin = resNull.headers['access-control-allow-origin'];
      const nullAllowCreds = resNull.headers['access-control-allow-credentials'];
      const nullAllowOriginStr = Array.isArray(nullAllowOrigin) ? nullAllowOrigin[0] : nullAllowOrigin;
      const nullAllowCredsBool = nullAllowCreds === 'true' || (Array.isArray(nullAllowCreds) && nullAllowCreds[0] === 'true');

      if (nullAllowOriginStr === 'null' && nullAllowCredsBool) {
        findings.push({
          ruleId: 'ZX-CORS-004',
          title: 'CORS Null Origin Allowed with Credentials',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'CORS Misconfiguration',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-942',
          owaspCategory: 'A01:2021-Broken Access Control',
          description: 'The server allows Origin "null" with credentials. Attackers can trigger requests from sandboxed iframes (<iframe sandbox>) to steal data.',
          remediation: 'Do not allow Origin "null" in Access-Control-Allow-Origin headers.',
          evidence: {
            originSent: 'null',
            reflectedAllowOrigin: nullAllowOriginStr,
            accessControlAllowCredentials: nullAllowCreds,
          },
        });
      }
    } catch {
      // Ignore network timeout
    }

    return findings;
  },
};
