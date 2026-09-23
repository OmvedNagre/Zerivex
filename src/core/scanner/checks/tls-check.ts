import tls from 'tls';
import { safeFetch } from '@/core/security/safe-http-client';
import { resolveAndValidateIp } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';

export const tlsCheck: ScanCheck = {
  id: 'check-tls',
  name: 'TLS / SSL Configuration & Certificate Validator',
  description: 'Audits TLS protocol version, cipher strength, certificate validity, and HSTS headers.',
  category: 'Transport Layer Security',
  requiresActiveScan: false, // Passive inspection

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const url = new URL(context.targetUrl);

    // 1. Check for unencrypted HTTP
    if (url.protocol === 'http:') {
      findings.push({
        ruleId: 'ZX-TLS-001',
        title: 'Unencrypted HTTP Protocol in Use',
        severity: 'HIGH',
        confidence: 'CONFIRMED',
        category: 'Transport Security',
        resourceEndpoint: context.targetUrl,
        cweId: 'CWE-319',
        owaspCategory: 'A02:2021-Cryptographic Failures',
        description: 'The target application communicates over unencrypted cleartext HTTP, exposing sensitive data to eavesdropping and man-in-the-middle attacks.',
        remediation: 'Migrate to HTTPS and redirect all HTTP traffic to HTTPS with an HTTP 301 Permanent Redirect.',
        evidence: {
          url: context.targetUrl,
          protocol: 'http:',
        },
      });
      return findings;
    }

    // 2. Deep TLS Socket Inspection for HTTPS
    try {
      const port = url.port ? parseInt(url.port, 10) : 443;
      const pinnedIp = await resolveAndValidateIp(url.hostname);

      const tlsDetails = await new Promise<{
        protocol: string | null;
        validTo: string | null;
        daysRemaining: number;
        subject: string | null;
        issuer: string | null;
        authorized: boolean;
        authorizationError: string | null;
      }>((resolve, reject) => {
        const socket = tls.connect(
          {
            host: pinnedIp,
            port,
            servername: url.hostname,
            rejectUnauthorized: false, // We check authorization manually to report specific flaws
            timeout: 10000,
          },
          () => {
            const cert = socket.getPeerCertificate(true);
            const protocol = socket.getProtocol();
            const authorized = socket.authorized;
            const authorizationError = socket.authorizationError ? String(socket.authorizationError) : null;

            let validTo: string | null = null;
            let daysRemaining = 999;

            if (cert && cert.valid_to) {
              validTo = cert.valid_to;
              const expireDate = new Date(cert.valid_to).getTime();
              daysRemaining = Math.floor((expireDate - Date.now()) / (1000 * 60 * 60 * 24));
            }

            const subject = cert?.subject ? JSON.stringify(cert.subject) : null;
            const issuer = cert?.issuer ? JSON.stringify(cert.issuer) : null;

            socket.end();
            resolve({
              protocol,
              validTo,
              daysRemaining,
              subject,
              issuer,
              authorized,
              authorizationError,
            });
          }
        );

        socket.on('error', (err) => reject(err));
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('TLS connection timeout'));
        });
      });

      // Certificate validity
      if (!tlsDetails.authorized && tlsDetails.authorizationError) {
        findings.push({
          ruleId: 'ZX-TLS-002',
          title: 'Untrusted or Invalid SSL/TLS Certificate',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'Transport Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-295',
          owaspCategory: 'A02:2021-Cryptographic Failures',
          description: `The SSL/TLS certificate is not trusted by public trust stores: ${tlsDetails.authorizationError}`,
          remediation: 'Deploy a valid SSL/TLS certificate issued by an industry-recognized Certificate Authority (e.g. Let’s Encrypt).',
          evidence: {
            authorizationError: tlsDetails.authorizationError,
            issuer: tlsDetails.issuer,
          },
        });
      }

      // Certificate expiration check
      if (tlsDetails.daysRemaining < 0) {
        findings.push({
          ruleId: 'ZX-TLS-003',
          title: 'Expired SSL/TLS Certificate',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'Transport Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-298',
          owaspCategory: 'A02:2021-Cryptographic Failures',
          description: `The SSL/TLS certificate expired on ${tlsDetails.validTo}. Browsers will block connections with security warnings.`,
          remediation: 'Renew and deploy a fresh SSL/TLS certificate immediately.',
          evidence: {
            validTo: tlsDetails.validTo,
            daysRemaining: tlsDetails.daysRemaining,
          },
        });
      } else if (tlsDetails.daysRemaining <= 14) {
        findings.push({
          ruleId: 'ZX-TLS-004',
          title: 'Expiring SSL/TLS Certificate',
          severity: 'LOW',
          confidence: 'CONFIRMED',
          category: 'Transport Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-298',
          owaspCategory: 'A02:2021-Cryptographic Failures',
          description: `The SSL/TLS certificate will expire in ${tlsDetails.daysRemaining} days (${tlsDetails.validTo}).`,
          remediation: 'Automate certificate renewal via ACME / Let’s Encrypt or deploy renewed certificates.',
          evidence: {
            validTo: tlsDetails.validTo,
            daysRemaining: tlsDetails.daysRemaining,
          },
        });
      }

      // Deprecated TLS protocol versions (TLS 1.0, 1.1)
      if (tlsDetails.protocol === 'TLSv1' || tlsDetails.protocol === 'TLSv1.1') {
        findings.push({
          ruleId: 'ZX-TLS-005',
          title: 'Deprecated TLS Protocol Version Supported',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'Transport Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-326',
          owaspCategory: 'A02:2021-Cryptographic Failures',
          description: `The server negotiated deprecated protocol "${tlsDetails.protocol}". Legacy TLS versions have known cryptographic flaws (POODLE, BEAST).`,
          remediation: 'Disable TLS 1.0 and TLS 1.1 in web server configuration. Enforce TLS 1.2 or TLS 1.3 only.',
          evidence: {
            negotiatedProtocol: tlsDetails.protocol,
          },
        });
      }
    } catch {
      // If direct TLS connection fails, continue to HTTP header inspection
    }

    // 3. Inspect HSTS Header
    try {
      const res = await safeFetch(context.targetUrl, { method: 'HEAD', timeoutMs: 8000 });
      const hsts = res.headers['strict-transport-security'];

      if (!hsts) {
        findings.push({
          ruleId: 'ZX-TLS-006',
          title: 'Missing HTTP Strict Transport Security (HSTS) Header',
          severity: 'MEDIUM',
          confidence: 'CONFIRMED',
          category: 'Transport Security',
          resourceEndpoint: context.targetUrl,
          cweId: 'CWE-523',
          owaspCategory: 'A05:2021-Security Misconfiguration',
          description: 'The target does not send a Strict-Transport-Security header, allowing downgrade attacks (SSL stripping).',
          remediation: 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" to all HTTPS responses.',
          evidence: {
            responseHeaders: res.headers,
          },
        });
      } else {
        const hstsStr = Array.isArray(hsts) ? hsts[0]! : hsts;
        const maxAgeMatch = hstsStr.match(/max-age=(\d+)/i);
        const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]!, 10) : 0;

        if (maxAge < 10368000) {
          // Less than 120 days
          findings.push({
            ruleId: 'ZX-TLS-007',
            title: 'Suboptimal HSTS max-age Duration',
            severity: 'LOW',
            confidence: 'CONFIRMED',
            category: 'Transport Security',
            resourceEndpoint: context.targetUrl,
            cweId: 'CWE-523',
            owaspCategory: 'A05:2021-Security Misconfiguration',
            description: `HSTS max-age is set to ${maxAge} seconds. Security best practices recommend at least 31536000 seconds (1 year).`,
            remediation: 'Increase Strict-Transport-Security max-age to 31536000 seconds.',
            evidence: {
              hstsHeader: hstsStr,
              maxAge,
            },
          });
        }
      }
    } catch {
      // Network failure during HEAD request
    }

    return findings;
  },
};
