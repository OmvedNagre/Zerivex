import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';

export const headersCheck: ScanCheck = {
  id: 'check-headers',
  name: 'HTTP Security Headers Evaluator',
  description: 'Audits essential browser security headers including CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.',
  category: 'Security Headers',
  requiresActiveScan: false,

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    let res;
    try {
      res = await safeFetch(context.targetUrl, { method: 'GET', timeoutMs: 12000 });
    } catch {
      return findings;
    }

    const headers = res.headers;

    // 1. Content-Security-Policy (CSP)
    const csp = headers['content-security-policy'];
    if (!csp) {
      findings.push({
        ruleId: 'ZX-HDR-001',
        title: 'Missing Content-Security-Policy (CSP) Header',
        severity: 'MEDIUM',
        confidence: 'CONFIRMED',
        category: 'Security Headers',
        resourceEndpoint: context.targetUrl,
        cweId: 'CWE-1021',
        owaspCategory: 'A05:2021-Security Misconfiguration',
        description: 'No Content-Security-Policy header was detected. CSP prevents Cross-Site Scripting (XSS), data injection, and clickjacking attacks.',
        remediation: "Deploy a Content-Security-Policy header defining strict script-src, object-src, and default-src directives.",
        evidence: { missingHeader: 'Content-Security-Policy' },
      });
    } else {
      const cspStr = Array.isArray(csp) ? csp.join('; ') : csp;
      if (cspStr.includes("'unsafe-inline'") || cspStr.includes("'unsafe-eval'")) {
        findings.push({
          ruleId: 'ZX-HDR-002',
          title: 'Permissive Content-Security-Policy Directives',
          severity: 'LOW',
          confidence: 'CONFIRMED',
          category: 'Security Headers',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-1021',
          owaspCategory: 'A05:2021-Security Misconfiguration',
          description: "CSP contains 'unsafe-inline' or 'unsafe-eval' which weakens protection against Cross-Site Scripting (XSS).",
          remediation: "Replace unsafe directives with cryptographic nonces (e.g. 'nonce-...') or SHA-256 script hashes.",
          evidence: { cspPolicy: cspStr },
        });
      }
    }

    // 2. X-Content-Type-Options
    const nosniff = headers['x-content-type-options'];
    const nosniffStr = Array.isArray(nosniff) ? nosniff[0] : nosniff;
    if (!nosniffStr || nosniffStr.toLowerCase() !== 'nosniff') {
      findings.push({
        ruleId: 'ZX-HDR-003',
        title: 'Missing X-Content-Type-Options: nosniff Header',
        severity: 'LOW',
        confidence: 'CONFIRMED',
        category: 'Security Headers',
        resourceEndpoint: context.targetUrl,
        cweId: 'CWE-16',
        owaspCategory: 'A05:2021-Security Misconfiguration',
        description: 'Missing X-Content-Type-Options header allows browsers to MIME-sniff responses, potentially executing malicious uploads as scripts.',
        remediation: 'Add "X-Content-Type-Options: nosniff" to all HTTP responses.',
        evidence: { actualValue: nosniffStr ?? null },
      });
    }

    // 3. X-Frame-Options / frame-ancestors (Clickjacking defense)
    const xfo = headers['x-frame-options'];
    const xfoStr = (Array.isArray(xfo) ? xfo[0] : xfo)?.toUpperCase();
    const hasFrameAncestors = csp && (Array.isArray(csp) ? csp.join(';') : csp).includes('frame-ancestors');

    if (!hasFrameAncestors && (!xfoStr || (!xfoStr.includes('DENY') && !xfoStr.includes('SAMEORIGIN')))) {
      findings.push({
        ruleId: 'ZX-HDR-004',
        title: 'Missing Clickjacking Defense (X-Frame-Options / frame-ancestors)',
        severity: 'MEDIUM',
        confidence: 'CONFIRMED',
        category: 'Security Headers',
        resourceEndpoint: context.targetUrl,
        cweId: 'CWE-1021',
        owaspCategory: 'A05:2021-Security Misconfiguration',
        description: 'The target lacks frame restriction headers, leaving it vulnerable to UI redressing (Clickjacking) within unauthorized iframes.',
        remediation: 'Configure "X-Frame-Options: DENY" or CSP "frame-ancestors \'none\';" on all user-interactive routes.',
        evidence: { xFrameOptions: xfoStr ?? null, hasFrameAncestors },
      });
    }

    // 4. Referrer-Policy
    const referrer = headers['referrer-policy'];
    const referrerStr = Array.isArray(referrer) ? referrer[0] : referrer;
    if (!referrerStr || referrerStr.toLowerCase() === 'unsafe-url') {
      findings.push({
        ruleId: 'ZX-HDR-005',
        title: 'Missing or Insecure Referrer-Policy Header',
        severity: 'LOW',
        confidence: 'CONFIRMED',
        category: 'Security Headers',
        resourceEndpoint: context.targetUrl,
        cweId: 'CWE-200',
        owaspCategory: 'A01:2021-Broken Access Control',
        description: 'Referrer-Policy is missing or set to unsafe-url, which may leak query parameters containing secrets or tokens to third parties.',
        remediation: 'Set "Referrer-Policy: strict-origin-when-cross-origin" or "no-referrer".',
        evidence: { referrerPolicy: referrerStr ?? null },
      });
    }

    // 5. Server Version Disclosure (Server / X-Powered-By)
    const server = headers['server'];
    const poweredBy = headers['x-powered-by'];
    const serverStr = Array.isArray(server) ? server[0] : server;
    const poweredByStr = Array.isArray(poweredBy) ? poweredBy[0] : poweredBy;

    if (poweredByStr || (serverStr && /\d+\.\d+/.test(serverStr))) {
      findings.push({
        ruleId: 'ZX-HDR-006',
        title: 'Server Technology Version Disclosure',
        severity: 'LOW',
        confidence: 'CONFIRMED',
        category: 'Information Disclosure',
        resourceEndpoint: context.targetUrl,
        cweId: 'CWE-200',
        owaspCategory: 'A05:2021-Security Misconfiguration',
        description: 'HTTP response headers disclose underlying runtime, framework, or web server software versions, assisting attackers in targeting known CVEs.',
        remediation: 'Disable Server tokens and remove the X-Powered-By header in web application configuration.',
        evidence: {
          server: serverStr ?? null,
          xPoweredBy: poweredByStr ?? null,
        },
      });
    }

    return findings;
  },
};
