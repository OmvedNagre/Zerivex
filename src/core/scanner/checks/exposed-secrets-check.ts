import { safeFetch } from '@/core/security/safe-http-client';
import { ScanCheck, ScanContext, RawFinding } from './types';

interface ProbeTarget {
  path: string;
  ruleId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  cweId: string;
  owaspCategory: string;
  description: string;
  remediation: string;
  validateContent: (body: string, contentType?: string) => boolean;
}

const PROBES: ProbeTarget[] = [
  {
    path: '/.env',
    ruleId: 'ZX-SEC-001',
    title: 'Exposed Environment (.env) Configuration File',
    severity: 'CRITICAL',
    cweId: 'CWE-200',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    description: 'The server directly serves the .env file containing plaintext environment variables, database credentials, API keys, and application secrets.',
    remediation: 'Block direct access to hidden files (.*) in web server configuration and move secrets outside the web document root.',
    validateContent: (body) => {
      // Must look like an env file, not an HTML 404 error page
      if (body.includes('<html') || body.includes('<!DOCTYPE')) return false;
      return /(?:DATABASE_URL|SECRET|API_KEY|PASSWORD|NODE_ENV|PORT)=/i.test(body);
    },
  },
  {
    path: '/.git/HEAD',
    ruleId: 'ZX-SEC-002',
    title: 'Exposed Git Repository Directory (/.git/HEAD)',
    severity: 'HIGH',
    cweId: 'CWE-200',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    description: 'The .git metadata directory is accessible over HTTP. Attackers can reconstruct the complete source code repository and history.',
    remediation: 'Configure web server or reverse proxy to block requests to "/.git" and all child paths.',
    validateContent: (body) => {
      if (body.includes('<html')) return false;
      return body.trim().startsWith('ref: refs/') || /^[a-f0-9]{40}$/i.test(body.trim());
    },
  },
  {
    path: '/.git/config',
    ruleId: 'ZX-SEC-003',
    title: 'Exposed Git Configuration (/.git/config)',
    severity: 'HIGH',
    cweId: 'CWE-200',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    description: 'The Git configuration file is accessible, potentially leaking private repository URLs, user tokens, and internal branch structures.',
    remediation: 'Block access to "/.git" in your reverse proxy (Nginx/Caddy/Cloudflare).',
    validateContent: (body) => {
      if (body.includes('<html')) return false;
      return body.includes('[core]') && (body.includes('repositoryformatversion') || body.includes('filemode'));
    },
  },
  {
    path: '/openapi.json',
    ruleId: 'ZX-SEC-004',
    title: 'Publicly Accessible OpenAPI Specification',
    severity: 'LOW',
    cweId: 'CWE-200',
    owaspCategory: 'A01:2021-Broken Access Control',
    description: 'The OpenAPI specification is publicly accessible without authentication, mapping internal endpoints, parameters, and API schemas.',
    remediation: 'Require authentication for API documentation endpoints or disable public schema exposure in production.',
    validateContent: (body) => {
      try {
        const json = JSON.parse(body);
        return typeof json === 'object' && json !== null && (Boolean(json.openapi) || Boolean(json.swagger));
      } catch {
        return false;
      }
    },
  },
  {
    path: '/swagger.json',
    ruleId: 'ZX-SEC-005',
    title: 'Publicly Accessible Swagger Specification',
    severity: 'LOW',
    cweId: 'CWE-200',
    owaspCategory: 'A01:2021-Broken Access Control',
    description: 'The Swagger schema is publicly accessible without authentication, revealing API routes and parameters.',
    remediation: 'Restrict access to Swagger endpoints using network controls or authentication.',
    validateContent: (body) => {
      try {
        const json = JSON.parse(body);
        return typeof json === 'object' && json !== null && (Boolean(json.swagger) || Boolean(json.openapi));
      } catch {
        return false;
      }
    },
  },
];

export const exposedSecretsCheck: ScanCheck = {
  id: 'check-exposed-secrets',
  name: 'Exposed Sensitive Files & API Schema Prober',
  description: 'Probes common sensitive paths (.env, .git, OpenAPI schemas) with content-aware validation to prevent false positives.',
  category: 'Information Disclosure',
  requiresActiveScan: false, // Standard GET requests to public paths

  async run(context: ScanContext): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const baseUrl = context.targetUrl.replace(/\/+$/, '');

    for (const probe of PROBES) {
      const probeUrl = `${baseUrl}${probe.path}`;

      try {
        const res = await safeFetch(probeUrl, {
          method: 'GET',
          timeoutMs: 8000,
          maxBodyBytes: 512 * 1024, // 512KB cap for probe responses
        });

        if (res.statusCode === 200 && probe.validateContent(res.body)) {
          findings.push({
            ruleId: probe.ruleId,
            title: probe.title,
            severity: probe.severity,
            confidence: 'CONFIRMED',
            category: 'Exposed Files',
            resourceEndpoint: probeUrl,
            cweId: probe.cweId,
            owaspCategory: probe.owaspCategory,
            description: probe.description,
            remediation: probe.remediation,
            evidence: {
              probeUrl,
              statusCode: res.statusCode,
              contentSnippet: res.body.substring(0, 500),
            },
          });
        }
      } catch {
        // Safe timeout or network failure, skip
      }
    }

    return findings;
  },
};
