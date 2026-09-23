import { safeFetch } from '@/core/security/safe-http-client';
import { activeRateLimiter, circuitBreaker } from '../active-rate-limiter';
import { ScanCheck, ScanContext, RawFinding } from './types';

export const securityTxtCheck: ScanCheck = {
  id: 'security-txt-check',
  name: 'RFC 9116 security.txt Validator',
  description: 'Verifies presence and RFC 9116 compliance of /.well-known/security.txt for coordinated vulnerability disclosure',
  category: 'Security Policy',
  requiresActiveScan: false,

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const baseParsed = new URL(context.targetUrl);
    const hostname = baseParsed.hostname;

    const pathsToTry = ['/.well-known/security.txt', '/security.txt'];
    let found = false;
    let foundContent = '';
    let foundUrl = '';

    for (const p of pathsToTry) {
      if (circuitBreaker.isOpen(hostname)) break;

      const testUrl = new URL(p, baseParsed.origin).toString();
      try {
        await activeRateLimiter.acquireToken(hostname);
        const res = await safeFetch(testUrl, {
          timeoutMs: 8000,
          followRedirects: true,
          maxRedirects: 2,
        });

        circuitBreaker.recordSuccess(hostname);

        if (res.statusCode === 200 && res.body.trim().length > 0) {
          // Verify it's not a generic HTML SPA 200 response
          const ct = (res.headers['content-type'] as string) || '';
          if (!ct.includes('text/html') || res.body.toLowerCase().includes('contact:')) {
            found = true;
            foundContent = res.body;
            foundUrl = testUrl;
            break;
          }
        }
      } catch (err) {
        circuitBreaker.recordFailure(hostname);
      }
    }

    if (!found) {
      findings.push({
        ruleId: 'ZX-SEC-SECTXT-001',
        title: 'Missing security.txt Disclosure Policy (RFC 9116)',
        severity: 'LOW',
        confidence: 'HIGH',
        category: 'Security Policy',
        resourceEndpoint: new URL('/.well-known/security.txt', baseParsed.origin).toString(),
        cweId: 'CWE-16',
        owaspCategory: 'A05:2021-Security Misconfiguration',
        description:
          'No RFC 9116 compliant security.txt file was found at /.well-known/security.txt. Security researchers discovering vulnerabilities in your application lack a secure, established channel to report issues.',
        evidence: {
          pathsChecked: pathsToTry,
          status: 'NOT_FOUND',
          rfcRequirement: 'RFC 9116 mandates Contact: directive and Expires: timestamp in /.well-known/security.txt',
        },
      });
      return findings;
    }

    // Found: validate RFC 9116 compliance
    const lines = foundContent.split('\n');
    let hasContact = false;
    let hasExpires = false;
    let isExpired = false;
    let expiresDateStr = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (/^Contact:\s+/i.test(line)) {
        hasContact = true;
      } else if (/^Expires:\s+/i.test(line)) {
        hasExpires = true;
        expiresDateStr = line.replace(/^Expires:\s+/i, '').trim();
        const parsedDate = new Date(expiresDateStr);
        if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() < Date.now()) {
          isExpired = true;
        }
      }
    }

    const issues: string[] = [];
    if (!hasContact) issues.push('Missing mandatory "Contact:" directive');
    if (!hasExpires) issues.push('Missing mandatory "Expires:" directive');
    if (isExpired) issues.push(`The security.txt policy expired on ${expiresDateStr}`);

    if (issues.length > 0) {
      findings.push({
        ruleId: 'ZX-SEC-SECTXT-001',
        title: 'Non-Compliant or Expired security.txt Policy (RFC 9116)',
        severity: 'LOW',
        confidence: 'CONFIRMED',
        category: 'Security Policy',
        resourceEndpoint: foundUrl,
        cweId: 'CWE-16',
        owaspCategory: 'A05:2021-Security Misconfiguration',
        description: `The security.txt file at ${foundUrl} fails RFC 9116 specification requirements: ${issues.join(', ')}.`,
        evidence: {
          url: foundUrl,
          complianceIssues: issues,
          hasContact,
          hasExpires,
          isExpired,
          contentPreview: foundContent.substring(0, 300),
        },
      });
    }

    return findings;
  },
};
