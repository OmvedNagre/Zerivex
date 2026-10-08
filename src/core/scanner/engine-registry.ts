import { PlanId, PLAN_RANK } from '@/core/billing/types';

/**
 * Engine Category Classification
 */
export type EngineCategory =
  | 'TRANSPORT'
  | 'HEADERS'
  | 'COOKIES'
  | 'CORS'
  | 'FILES'
  | 'DISCLOSURE'
  | 'API'
  | 'AI_SMELLS'
  | 'INJECTION'
  | 'REDIRECT'
  | 'TRAVERSAL';

/**
 * Single Source of Truth for Scanner Engine Capabilities (§F2)
 * Pure module without server-only dependencies.
 */
export interface EngineDefinition {
  id: string;
  displayName: string;
  doingLine: string;
  doneLine?: (findingsCount: number) => string;
  class: 'PASSIVE' | 'ACTIVE';
  minPlan: PlanId;
  needsVerifiedOwnership: boolean;
  needsDiscoveredInputs: boolean;
  category: EngineCategory;
  ruleIdPrefix: string;
  weight: number;
  version: string;
}

export interface RoadmapEngine {
  id: string;
  displayName: string;
  category: string;
  description: string;
  status: 'COMING_SOON';
}

/**
 * Canonical 14 Engines Matrix (§F2, Appendix A)
 * Starter: 7 engines (passive)
 * Pro / Team / Enterprise: 14 engines (10 passive + 4 active verified)
 */
export const SCAN_ENGINES: readonly EngineDefinition[] = [
  {
    id: 'check-tls',
    displayName: 'TLS & Certificate',
    doingLine: 'Checking your HTTPS certificate, TLS version and HSTS',
    doneLine: (n) => (n === 0 ? 'TLS & HTTPS configuration validated' : `${n} TLS certificate issues detected`),
    class: 'PASSIVE',
    minPlan: 'STARTER',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'TRANSPORT',
    ruleIdPrefix: 'ZX-TLS',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-headers',
    displayName: 'Security Headers',
    doingLine: 'Checking CSP, clickjacking, MIME-sniffing, referrer and permissions headers',
    doneLine: (n) => (n === 0 ? 'Security headers enforced' : `${n} missing or weak security headers`),
    class: 'PASSIVE',
    minPlan: 'STARTER',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'HEADERS',
    ruleIdPrefix: 'ZX-HDR',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-cookies',
    displayName: 'Cookie Flags',
    doingLine: 'Checking Secure, HttpOnly and SameSite on your cookies',
    doneLine: (n) => (n === 0 ? 'Cookie security flags verified' : `${n} insecure cookie attributes`),
    class: 'PASSIVE',
    minPlan: 'STARTER',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'COOKIES',
    ruleIdPrefix: 'ZX-CKI',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-cors',
    displayName: 'CORS Policy',
    doingLine: 'Checking whether other websites can read your responses',
    doneLine: (n) => (n === 0 ? 'Cross-origin resource sharing restricted' : `${n} permissive CORS origin policies`),
    class: 'PASSIVE',
    minPlan: 'STARTER',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'CORS',
    ruleIdPrefix: 'ZX-CORS',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-exposed-secrets',
    displayName: 'Exposed Secrets & Files',
    doingLine: 'Checking whether /.env and /.git are publicly readable',
    doneLine: (n) => (n === 0 ? 'No exposed secrets or metadata files found' : `${n} sensitive files publicly readable`),
    class: 'PASSIVE',
    minPlan: 'STARTER',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'FILES',
    ruleIdPrefix: 'ZX-SEC',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-security-txt',
    displayName: 'security.txt',
    doingLine: 'Checking for a security contact file (RFC 9116)',
    doneLine: (n) => (n === 0 ? 'security.txt contact policy present' : 'Missing RFC 9116 security.txt contact file'),
    class: 'PASSIVE',
    minPlan: 'STARTER',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'DISCLOSURE',
    ruleIdPrefix: 'ZX-TXT',
    weight: 0.5,
    version: '1.0.0',
  },
  {
    id: 'check-ai-code-smells',
    displayName: 'AI Code Smells',
    doingLine: 'Checking for leftover debug, seed and GraphQL introspection routes',
    doneLine: (n) => (n === 0 ? 'No exposed debug routes or introspection found' : `${n} exposed debug routes or interfaces`),
    class: 'PASSIVE',
    minPlan: 'STARTER',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'AI_SMELLS',
    ruleIdPrefix: 'ZX-AI',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-http-methods',
    displayName: 'HTTP Methods',
    doingLine: 'Checking whether risky methods like TRACE, PUT or DELETE are allowed',
    doneLine: (n) => (n === 0 ? 'HTTP verb restrictions validated' : `${n} risky HTTP methods permitted`),
    class: 'PASSIVE',
    minPlan: 'PRO',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'API',
    ruleIdPrefix: 'ZX-MTH',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-stack-trace',
    displayName: 'Error Leaks',
    doingLine: 'Checking whether errors reveal stack traces or file paths',
    doneLine: (n) => (n === 0 ? 'Error responses properly sanitized' : `${n} verbose stack traces or path disclosures`),
    class: 'PASSIVE',
    minPlan: 'PRO',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'DISCLOSURE',
    ruleIdPrefix: 'ZX-ERR',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-api-security',
    displayName: 'Open API Endpoints',
    doingLine: 'Checking common API paths for data anyone can read',
    doneLine: (n) => (n === 0 ? 'Common unauthenticated API endpoints protected' : `${n} unauthenticated API endpoints exposed`),
    class: 'PASSIVE',
    minPlan: 'PRO',
    needsVerifiedOwnership: false,
    needsDiscoveredInputs: false,
    category: 'API',
    ruleIdPrefix: 'ZX-API',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-sqli',
    displayName: 'SQL Injection',
    doingLine: 'Testing parameters for SQL injection (safe, non-destructive probes)',
    doneLine: (n) => (n === 0 ? 'No SQL injection vulnerabilities detected' : `${n} SQL injection vulnerabilities detected`),
    class: 'ACTIVE',
    minPlan: 'PRO',
    needsVerifiedOwnership: true,
    needsDiscoveredInputs: true,
    category: 'INJECTION',
    ruleIdPrefix: 'ZX-SQL',
    weight: 1.5,
    version: '1.0.0',
  },
  {
    id: 'check-xss',
    displayName: 'Reflected XSS',
    doingLine: 'Testing parameters for reflected script injection',
    doneLine: (n) => (n === 0 ? 'No reflected XSS vulnerabilities detected' : `${n} reflected XSS vulnerabilities detected`),
    class: 'ACTIVE',
    minPlan: 'PRO',
    needsVerifiedOwnership: true,
    needsDiscoveredInputs: true,
    category: 'INJECTION',
    ruleIdPrefix: 'ZX-XSS',
    weight: 1.5,
    version: '1.0.0',
  },
  {
    id: 'check-open-redirect',
    displayName: 'Open Redirects',
    doingLine: 'Testing redirect parameters for open redirects',
    doneLine: (n) => (n === 0 ? 'No open redirect vulnerabilities detected' : `${n} open redirect parameters detected`),
    class: 'ACTIVE',
    minPlan: 'PRO',
    needsVerifiedOwnership: true,
    needsDiscoveredInputs: true,
    category: 'REDIRECT',
    ruleIdPrefix: 'ZX-RED',
    weight: 1.0,
    version: '1.0.0',
  },
  {
    id: 'check-path-traversal',
    displayName: 'Path Traversal',
    doingLine: 'Testing file parameters for directory traversal',
    doneLine: (n) => (n === 0 ? 'No path traversal vulnerabilities detected' : `${n} path traversal vulnerabilities detected`),
    class: 'ACTIVE',
    minPlan: 'PRO',
    needsVerifiedOwnership: true,
    needsDiscoveredInputs: true,
    category: 'TRAVERSAL',
    ruleIdPrefix: 'ZX-TRV',
    weight: 1.0,
    version: '1.0.0',
  },
];

/**
 * Roadmap Engines (§F2)
 * These hold planned capabilities. They are NEVER counted in "N of 14"
 * and render strictly as "Coming soon" pills in the pricing matrix and receipts.
 */
export const ROADMAP_ENGINES: readonly RoadmapEngine[] = [
  {
    id: 'check-api-schema-fuzzing',
    displayName: 'API Schema Fuzzing',
    category: 'API Security',
    description: 'Dynamic schema boundary tests, type violation payloads, and auth bypass fuzzing.',
    status: 'COMING_SOON',
  },
  {
    id: 'check-authenticated-sessions',
    displayName: 'Authenticated Session Scan',
    category: 'Deep Application Security',
    description: 'Automated role-based privilege escalation checks behind cookie/bearer authentication.',
    status: 'COMING_SOON',
  },
  {
    id: 'check-ai-repo-analysis',
    displayName: 'AI Repository Code Analysis',
    category: 'Source Code Security',
    description: 'Direct GitHub/GitLab integration auditing AST branches for vibe-coding vulnerabilities.',
    status: 'COMING_SOON',
  },
];

export const TOTAL_ENGINES_COUNT = SCAN_ENGINES.length; // Exactly 14

/**
 * Total weight of all 14 engines combined
 */
export const TOTAL_ENGINES_WEIGHT = SCAN_ENGINES.reduce((sum, e) => sum + e.weight, 0);

/**
 * Look up an engine definition by its identifier.
 */
export function getEngineById(engineId: string): EngineDefinition | undefined {
  return SCAN_ENGINES.find((e) => e.id === engineId);
}

/**
 * Return all engines available to a given plan tier.
 */
export function enginesForPlan(planId: PlanId): EngineDefinition[] {
  const currentRank = PLAN_RANK[planId] || 1;
  return SCAN_ENGINES.filter((e) => {
    const minRank = PLAN_RANK[e.minPlan] || 1;
    return currentRank >= minRank;
  });
}

/**
 * Return the minimum plan required for a given engine.
 */
export function planForEngine(engineId: string): PlanId | undefined {
  const engine = getEngineById(engineId);
  return engine?.minPlan;
}

export type EnginePreviewStatus = 'AVAILABLE' | 'LOCKED_BY_PLAN' | 'LOCKED_UNVERIFIED';

export interface EnginePreviewResult {
  engine: EngineDefinition;
  status: EnginePreviewStatus;
  lockedBy: 'PLAN' | 'VERIFICATION' | null;
  requiredPlan?: PlanId;
  alsoRequiresVerification?: boolean;
}

/**
 * Evaluates engine availability for a given plan and target verification state (§F2).
 * Precedence rule: PLAN FIRST.
 * If both plan and verification block the engine:
 * lockedBy: 'PLAN', requiredPlan: engine.minPlan, alsoRequiresVerification: true.
 */
export function planEnginePreview(
  planId: PlanId,
  opts: { targetVerified: boolean }
): EnginePreviewResult[] {
  const currentRank = PLAN_RANK[planId] || 1;

  return SCAN_ENGINES.map((engine) => {
    const requiredRank = PLAN_RANK[engine.minPlan] || 1;
    const planAllowed = currentRank >= requiredRank;
    const verificationNeeded = engine.needsVerifiedOwnership && !opts.targetVerified;

    if (!planAllowed) {
      return {
        engine,
        status: 'LOCKED_BY_PLAN',
        lockedBy: 'PLAN',
        requiredPlan: engine.minPlan,
        alsoRequiresVerification: verificationNeeded,
      };
    }

    if (verificationNeeded) {
      return {
        engine,
        status: 'LOCKED_UNVERIFIED',
        lockedBy: 'VERIFICATION',
        requiredPlan: undefined,
        alsoRequiresVerification: false,
      };
    }

    return {
      engine,
      status: 'AVAILABLE',
      lockedBy: null,
    };
  });
}
