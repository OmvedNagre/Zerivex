/**
 * Zerivex CI/CD Security Quality Gate Engine
 * Deterministic build-breaker policy evaluation for continuous integration pipelines.
 */

import { FindingRecord, ScanJobRecord } from '@/core/scanner/scan-runner';

export interface QualityGatePolicy {
  id?: string;
  organizationId: string;
  targetId?: string | null;
  name: string;
  minSecurityScore: number;
  failOnCritical: boolean;
  maxHighFindings: number;
  maxMediumFindings: number;
  failOnNewFindings: boolean;
  isDefault?: boolean;
}

export interface GateEvaluationResult {
  passed: boolean;
  status: 'PASSED' | 'FAILED' | 'WARNED';
  score: number;
  minSecurityScore: number;
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
    total: number;
  };
  reasons: string[];
  evaluatedAt: Date;
  summaryText: string;
  markdownSummary: string;
}

export const DEFAULT_QUALITY_GATE_POLICY: Omit<QualityGatePolicy, 'organizationId'> = {
  name: 'Standard Security Gate',
  minSecurityScore: 80,
  failOnCritical: true,
  maxHighFindings: 0,
  maxMediumFindings: 5,
  failOnNewFindings: false,
  isDefault: true,
};

/**
 * Evaluate scan results against the applicable quality gate policy.
 */
export function evaluateQualityGate(
  scanJob: Pick<ScanJobRecord, 'id' | 'status' | 'score'>,
  findings: FindingRecord[],
  policy: QualityGatePolicy,
  previousFindings?: FindingRecord[]
): GateEvaluationResult {
  const reasons: string[] = [];
  const evaluatedAt = new Date();

  // 1. Verify scan completion
  if (scanJob.status !== 'COMPLETED') {
    reasons.push(`Scan job did not complete successfully (current status: ${scanJob.status})`);
  }

  const score = scanJob.score ?? 0;

  // 2. Count active findings by severity
  const activeFindings = findings.filter(
    (f) => f.status === 'OPEN' || f.status === 'CONFIRMED' || f.status === 'REOPENED'
  );

  const findingsCount = {
    critical: activeFindings.filter((f) => f.severity === 'CRITICAL').length,
    high: activeFindings.filter((f) => f.severity === 'HIGH').length,
    medium: activeFindings.filter((f) => f.severity === 'MEDIUM').length,
    low: activeFindings.filter((f) => f.severity === 'LOW').length,
    informational: activeFindings.filter((f) => f.severity === 'INFORMATIONAL').length,
    total: activeFindings.length,
  };

  // 3. Security Score Threshold
  if (score < policy.minSecurityScore) {
    reasons.push(
      `Security score of ${score}/100 is below the required gate threshold of ${policy.minSecurityScore}/100`
    );
  }

  // 4. Critical Severity Gate
  if (policy.failOnCritical && findingsCount.critical > 0) {
    const criticalTitles = activeFindings
      .filter((f) => f.severity === 'CRITICAL')
      .map((f) => f.title)
      .slice(0, 3)
      .join(', ');
    reasons.push(
      `Detected ${findingsCount.critical} CRITICAL severity finding(s) (allowed: 0) [${criticalTitles}]`
    );
  }

  // 5. High Severity Gate
  if (findingsCount.high > policy.maxHighFindings) {
    reasons.push(
      `Detected ${findingsCount.high} HIGH severity finding(s), exceeding maximum allowance of ${policy.maxHighFindings}`
    );
  }

  // 6. Medium Severity Gate
  if (findingsCount.medium > policy.maxMediumFindings) {
    reasons.push(
      `Detected ${findingsCount.medium} MEDIUM severity finding(s), exceeding maximum allowance of ${policy.maxMediumFindings}`
    );
  }

  // 7. New Findings Regression Gate
  if (policy.failOnNewFindings && previousFindings) {
    const prevFingerprints = new Set(
      previousFindings.map((f) => `${f.ruleId}::${f.resourceEndpoint}`)
    );
    const newFindings = activeFindings.filter(
      (f) => !prevFingerprints.has(`${f.ruleId}::${f.resourceEndpoint}`)
    );

    if (newFindings.length > 0) {
      reasons.push(
        `Introduced ${newFindings.length} newly detected security vulnerability finding(s)`
      );
    }
  }

  const passed = reasons.length === 0;
  const status: 'PASSED' | 'FAILED' = passed ? 'PASSED' : 'FAILED';

  // Format concise CLI summary text
  const summaryText = passed
    ? `[PASSED] Zerivex Quality Gate '${policy.name}' - Score: ${score}/100, 0 Critical, ${findingsCount.high} High, ${findingsCount.medium} Medium`
    : `[FAILED] Zerivex Quality Gate '${policy.name}' - ${reasons.join('; ')}`;

  // Format rich GitHub Actions / GitLab Markdown comment
  const markdownSummary = `
### ${passed ? '✅ Zerivex Security Gate: PASSED' : '❌ Zerivex Security Gate: FAILED'}

**Policy:** ${policy.name}  
**Security Score:** **${score}/100** (Threshold: ${policy.minSecurityScore}/100)  
**Evaluated At:** ${evaluatedAt.toISOString()}  

| Severity | Count | Allowed Threshold |
| :--- | :--- | :--- |
| **CRITICAL** | ${findingsCount.critical} | ${policy.failOnCritical ? '0' : 'Unlimited'} |
| **HIGH** | ${findingsCount.high} | Max ${policy.maxHighFindings} |
| **MEDIUM** | ${findingsCount.medium} | Max ${policy.maxMediumFindings} |
| **LOW** | ${findingsCount.low} | Info |
| **INFORMATIONAL** | ${findingsCount.informational} | Info |

${
  !passed
    ? `\n#### Gate Failure Reasons:\n${reasons.map((r) => `- ❌ ${r}`).join('\n')}\n`
    : '\n> **All security quality gate requirements satisfied.** Ready for pipeline progression.\n'
}
`.trim();

  return {
    passed,
    status,
    score,
    minSecurityScore: policy.minSecurityScore,
    findingsCount,
    reasons,
    evaluatedAt,
    summaryText,
    markdownSummary,
  };
}
