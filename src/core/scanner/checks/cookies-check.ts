import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';

export const cookiesCheck: ScanCheck = {
  id: 'check-cookies',
  name: 'Cookie Security & Flag Auditor',
  description: 'Audits Set-Cookie headers for Secure, HttpOnly, and SameSite attribute enforcement.',
  category: 'Session Management',
  requiresActiveScan: false,

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const isHttps = context.targetUrl.startsWith('https:');

    let res;
    try {
      res = await safeFetch(context.targetUrl, { method: 'GET', timeoutMs: 10000 });
    } catch {
      return findings;
    }

    const rawCookies = res.headers['set-cookie'];
    if (!rawCookies) return findings;

    const cookieList = Array.isArray(rawCookies) ? rawCookies : [rawCookies];

    for (const cookieStr of cookieList) {
      const parts = cookieStr.split(';').map((p) => p.trim());
      const nameVal = parts[0] || '';
      const cookieName = nameVal.split('=')[0]?.trim() || 'unknown';

      const lowerParts = parts.map((p) => p.toLowerCase());
      const hasSecure = lowerParts.includes('secure');
      const hasHttpOnly = lowerParts.includes('httponly');
      const sameSiteDirective = lowerParts.find((p) => p.startsWith('samesite='));

      // Check 1: Missing Secure flag on HTTPS
      if (isHttps && !hasSecure) {
        findings.push({
          ruleId: 'ZX-CK-001',
          title: `Cookie "${cookieName}" Missing Secure Flag`,
          severity: 'MEDIUM',
          confidence: 'CONFIRMED',
          category: 'Cookie Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-614',
          owaspCategory: 'A05:2021-Security Misconfiguration',
          description: `The cookie "${cookieName}" was set without the "Secure" flag over an HTTPS connection. It can be transmitted over unencrypted HTTP, allowing interception.`,
          remediation: `Append "; Secure" to the Set-Cookie directive for "${cookieName}".`,
          evidence: {
            cookieName,
            rawCookieHeader: cookieStr,
          },
        });
      }

      // Check 2: Missing HttpOnly flag
      if (!hasHttpOnly) {
        // Higher severity if name suggests a session/auth token
        const isAuthToken = /sess|auth|token|jwt|id|key/i.test(cookieName);
        findings.push({
          ruleId: 'ZX-CK-002',
          title: `Cookie "${cookieName}" Missing HttpOnly Flag`,
          severity: isAuthToken ? 'MEDIUM' : 'LOW',
          confidence: 'CONFIRMED',
          category: 'Cookie Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-1004',
          owaspCategory: 'A05:2021-Security Misconfiguration',
          description: `The cookie "${cookieName}" was set without the "HttpOnly" flag, allowing client-side JavaScript access (document.cookie) and increasing XSS vulnerability impact.`,
          remediation: `Append "; HttpOnly" to the Set-Cookie directive for "${cookieName}".`,
          evidence: {
            cookieName,
            rawCookieHeader: cookieStr,
          },
        });
      }

      // Check 3: Missing SameSite attribute
      if (!sameSiteDirective) {
        findings.push({
          ruleId: 'ZX-CK-003',
          title: `Cookie "${cookieName}" Missing SameSite Attribute`,
          severity: 'LOW',
          confidence: 'CONFIRMED',
          category: 'Cookie Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-1275',
          owaspCategory: 'A01:2021-Broken Access Control',
          description: `The cookie "${cookieName}" does not specify a SameSite policy, leaving it vulnerable to Cross-Site Request Forgery (CSRF).`,
          remediation: `Set "; SameSite=Lax" or "; SameSite=Strict" on "${cookieName}".`,
          evidence: {
            cookieName,
            rawCookieHeader: cookieStr,
          },
        });
      }
    }

    return findings;
  },
};
