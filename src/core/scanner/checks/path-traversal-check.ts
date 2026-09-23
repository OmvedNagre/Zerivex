import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';
import { defaultRateLimiter, defaultCircuitBreaker, CircuitBreakerOpenError } from '../active-rate-limiter';

interface TraversalTarget {
  os: 'Unix' | 'Windows';
  payloads: string[];
  patterns: RegExp[];
}

const TRAVERSAL_TARGETS: TraversalTarget[] = [
  {
    os: 'Unix',
    payloads: [
      '../../../../../../../../etc/passwd',
      '..%2F..%2F..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd',
      '/etc/passwd',
    ],
    patterns: [
      /root:x:0:0:/i,
      /root:\*:[0-9]+:[0-9]+:/i,
      /daemon:x:[0-9]+:[0-9]+:/i,
      /nobody:x:[0-9]+:[0-9]+:/i,
      /[a-z_][a-z0-9_-]*:x:[0-9]+:[0-9]+:[^:]*:\/[^:]*:\/(bin|usr\/bin)\/(ba)?sh/i,
    ],
  },
  {
    os: 'Windows',
    payloads: [
      '..\\..\\..\\..\\..\\..\\..\\..\\windows\\win.ini',
      '..%5C..%5C..%5C..%5C..%5C..%5C..%5C..%5Cwindows%5Cwin.ini',
      'C:\\windows\\win.ini',
    ],
    patterns: [
      /\[fonts\]/i,
      /\[extensions\]/i,
      /for 16-bit app support/i,
    ],
  },
];

const TRAVERSAL_PARAMS = [
  'file',
  'path',
  'page',
  'doc',
  'folder',
  'template',
  'include',
  'view',
  'read',
  'download',
];

export const pathTraversalCheck: ScanCheck = {
  id: 'check-path-traversal',
  name: 'Active Path Traversal & Arbitrary File Read Prober',
  description: 'Probes resource and template parameters with dot-dot-slash sequence payloads to detect directory traversal vulnerabilities exposing host operating system files.',
  category: 'Broken Access Control',
  requiresActiveScan: true,

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    if (context.scanMode !== 'VERIFIED_ACTIVE') {
      return findings;
    }

    const parsed = new URL(context.targetUrl);
    const existingParams = Array.from(parsed.searchParams.keys());
    const candidateParams = existingParams.length > 0 ? existingParams : TRAVERSAL_PARAMS;

    for (const param of candidateParams) {
      if (defaultCircuitBreaker.isOpen(context.hostname)) break;

      let vulnFound = false;

      for (const target of TRAVERSAL_TARGETS) {
        if (vulnFound || defaultCircuitBreaker.isOpen(context.hostname)) break;

        for (const payload of target.payloads) {
          if (vulnFound || defaultCircuitBreaker.isOpen(context.hostname)) break;

          const testUrl = new URL(context.targetUrl);
          testUrl.searchParams.set(param, payload);

          try {
            await defaultRateLimiter.acquire(context.hostname);
            const res = await safeFetch(testUrl.toString(), {
              method: 'GET',
              timeoutMs: 8000,
            });

            // Inspect body for definitive OS file signatures
            for (const pattern of target.patterns) {
              const match = res.body.match(pattern);
              if (match) {
                const matchIndex = match.index ?? 0;
                const snippet = res.body.substring(
                  Math.max(0, matchIndex - 40),
                  Math.min(res.body.length, matchIndex + 160)
                );

                findings.push({
                  ruleId: 'ZX-ACT-TRAV-001',
                  title: `Path Traversal / Local File Read (${target.os}) in Parameter "${param}"`,
                  severity: 'HIGH',
                  confidence: 'CONFIRMED',
                  category: 'Broken Access Control',
                  resourceEndpoint: testUrl.toString(),
                  cweId: 'CWE-22',
                  owaspCategory: 'A01:2021-Broken Access Control',
                  description: `The application returned the contents of a sensitive ${target.os} system file when probed with path traversal payload "${payload}" in parameter "${param}". Attackers can read configuration files, application source code, and credentials.`,
                  remediation: `Use path normalization (e.g. path.resolve/path.normalize) and strictly verify that the resolved canonical path starts with the allowed root directory. Alternatively, use an explicit dictionary allowlist of permitted filenames rather than passing user strings directly to file system APIs.`,
                  evidence: {
                    parameter: param,
                    probePayload: payload,
                    targetOS: target.os,
                    matchedSignature: match[0],
                    responseSnippet: snippet,
                    responseStatusCode: res.statusCode,
                  },
                });

                vulnFound = true;
                defaultCircuitBreaker.recordSuccess(context.hostname);
                break;
              }
            }

            if (res.statusCode >= 500 && !vulnFound) {
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
      }
    }

    return findings;
  },
};
