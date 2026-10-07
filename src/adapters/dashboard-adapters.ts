/**
 * ZERIVEX Central Dashboard Adapters
 * 
 * Rules:
 * 1. Components NEVER touch raw API responses directly.
 * 2. Explicit state: { status: 'loading' | 'error' | 'empty' | 'ready', data? }.
 * 3. Never default failed, missing, or error data to 0 / A+ / PASSED.
 * 4. Truthfulness: "Zero active defects" only when at least 1 completed scan
 *    exists and open issues = 0.
 * 5. Open findings must match statuses: OPEN | CONFIRMED | REOPENED.
 *    Closed/triage: FIXED | FALSE_POSITIVE | ACCEPTED_RISK.
 */

export type AdapterStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface AdapterState<T> {
  status: AdapterStatus;
  data?: T;
  error?: string;
}

// ============================================================================
// Overview Data Model
// ============================================================================

export interface OverviewData {
  fleetScore: number | null;
  grade: 'A+' | 'A' | 'B' | 'C' | '—';
  headlineState: 'needs_attention' | 'clean' | 'monitoring' | 'no_scans';
  headlineTitle: string;
  headlineDescription: string;
  openFindings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  targetsCount: number;
  verifiedTargetsCount: number;
  scansCount: number;
  completedScansCount: number;
  qualityGate: {
    status: 'PASSED' | 'FAILED' | 'NOT_CONFIGURED';
    label: string;
    description: string;
  };
  health: {
    status: 'nominal' | 'degraded' | 'outage';
    label: string;
  };
  topFixes: Array<{
    id: string;
    ruleId: string;
    title: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    targetUrl: string;
    resourceEndpoint?: string | null;
  }>;
  recentScans: Array<{
    id: string;
    targetHostname: string;
    targetUrl: string;
    scanMode: string;
    status: string;
    score: number | null;
    completedAt?: string | null;
    createdAt: string;
  }>;
  scoreCalculationExplanation: string;
}

// ============================================================================
// Next Best Action Model
// ============================================================================

export interface NextBestAction {
  actionId: 'add_target' | 'verify_target' | 'run_scan' | 'fix_finding' | 'add_ci_gate' | 'schedule_scan';
  title: string;
  description: string;
  href: string;
  cta: string;
  findingId?: string;
  targetId?: string;
}

// ============================================================================
// Targets Table Row Model
// ============================================================================

export interface EnrichedTargetRow {
  targetId: string;
  hostname: string;
  targetUrl: string;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'REVOKED';
  score: number | null;
  openIssues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  lastScanTimestamp: string | null;
  lastScanStatus: string | null;
  latestScanId: string | null;
}

// ============================================================================
// Findings Group Model
// ============================================================================

export interface FindingGroupItem {
  groupKey: string;
  ruleId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidenceLabel: string;
  endpoint: string;
  targetUrl: string;
  targetId: string;
  cweId: string | null;
  owaspCategory: string | null;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestFinding: any;
  occurrences: any[];
}

export interface FindingsSeverityStats {
  openCriticalHigh: number;
  needsTriage: number;
  acceptedRisk: number;
  fixedAndVerified: number;
}

// ============================================================================
// Nav Badges Model
// ============================================================================

export interface NavBadges {
  openCriticalHigh: number;
  scansInProgress: number;
  unreadAlerts: number;
}

// ============================================================================
// Helper Status Checkers
// ============================================================================

export function isOpenFindingStatus(status?: string | null): boolean {
  if (!status) return true;
  const s = status.toUpperCase();
  return s === 'OPEN' || s === 'CONFIRMED' || s === 'REOPENED';
}

export function isClosedFindingStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === 'FIXED' || s === 'FALSE_POSITIVE' || s === 'ACCEPTED_RISK';
}

// ============================================================================
// Pure Adapter Functions
// ============================================================================

export function adaptOverview(inputs: {
  targets?: any[] | null;
  scans?: any[] | null;
  findings?: any[] | null;
  qualityGate?: any | null;
  health?: any | null;
  error?: string | null;
  loading?: boolean;
}): AdapterState<OverviewData> {
  if (inputs.loading) {
    return { status: 'loading' };
  }

  if (inputs.error) {
    return { status: 'error', error: inputs.error };
  }

  const targetsList = Array.isArray(inputs.targets) ? inputs.targets : [];
  const scansList = Array.isArray(inputs.scans) ? inputs.scans : [];
  const findingsList = Array.isArray(inputs.findings) ? inputs.findings : [];

  const verifiedTargetsCount = targetsList.filter(
    (t) => t.verificationStatus === 'VERIFIED'
  ).length;

  // Filter open findings strictly
  let crit = 0;
  let high = 0;
  let med = 0;
  let low = 0;

  for (const f of findingsList) {
    if (isOpenFindingStatus(f.status)) {
      const sev = (f.severity || '').toUpperCase();
      if (sev === 'CRITICAL') crit++;
      else if (sev === 'HIGH') high++;
      else if (sev === 'MEDIUM') med++;
      else if (sev === 'LOW') low++;
    }
  }

  const totalOpen = crit + high + med + low;
  const critHighCount = crit + high;

  // Compute fleet score: mean of latest completed scan score per target
  const completedScans = scansList.filter((s) => s.status === 'COMPLETED' && s.score !== null && s.score !== undefined);

  // Group by targetId to find latest completed scan per target
  const latestCompletedByTarget = new Map<string, any>();
  for (const s of completedScans) {
    const key = s.targetId || s.targetUrl;
    if (!key) continue;
    const existing = latestCompletedByTarget.get(key);
    if (!existing) {
      latestCompletedByTarget.set(key, s);
    } else {
      const existingDate = new Date(existing.completedAt || existing.createdAt).getTime();
      const sDate = new Date(s.completedAt || s.createdAt).getTime();
      if (sDate > existingDate) {
        latestCompletedByTarget.set(key, s);
      }
    }
  }

  let fleetScore: number | null = null;
  if (latestCompletedByTarget.size > 0) {
    const scores = Array.from(latestCompletedByTarget.values()).map((s) => Number(s.score));
    const sum = scores.reduce((acc, val) => acc + val, 0);
    fleetScore = Math.round(sum / scores.length);
  } else if (completedScans.length > 0) {
    const scores = completedScans.map((s) => Number(s.score));
    fleetScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // Derive Grade and Headline State with Truthfulness Rules
  let grade: 'A+' | 'A' | 'B' | 'C' | '—' = '—';
  let headlineState: 'needs_attention' | 'clean' | 'monitoring' | 'no_scans' = 'no_scans';
  let headlineTitle = 'No scans yet';
  let headlineDescription = 'Register a site and run your first scan to establish your security baseline.';

  if (completedScans.length === 0) {
    fleetScore = null;
    grade = '—';
    headlineState = 'no_scans';
    headlineTitle = 'No scans completed yet';
    headlineDescription = 'Run an initial scan across your verified targets to establish a security baseline.';
  } else if (critHighCount > 0) {
    // If open Critical/High exists, headline is Needs Attention, and Grade CANNOT be A+
    headlineState = 'needs_attention';
    headlineTitle = `Needs attention: ${critHighCount} critical/high ${critHighCount === 1 ? 'issue' : 'issues'} open`;
    headlineDescription = 'Immediate remediation recommended to protect exposed attack surface.';
    
    // Grade downgraded based on fleet score, clamped to max 'B'
    if (fleetScore === null || fleetScore < 60) grade = 'C';
    else grade = 'B';
  } else if (totalOpen === 0) {
    // Zero active defects only when data loaded, completed scan exists, and open findings = 0
    headlineState = 'clean';
    headlineTitle = 'No open issues';
    headlineDescription = 'All verified sites passed current passive and active security batteries.';
    if (fleetScore !== null && fleetScore >= 95) grade = 'A+';
    else if (fleetScore !== null && fleetScore >= 85) grade = 'A';
    else grade = 'B';
  } else {
    // Only medium/low open
    headlineState = 'monitoring';
    headlineTitle = `${totalOpen} low/medium ${totalOpen === 1 ? 'finding' : 'findings'} open`;
    headlineDescription = 'No critical defects found. Review low and medium items during routine maintenance.';
    if (fleetScore !== null && fleetScore >= 90) grade = 'A';
    else if (fleetScore !== null && fleetScore >= 75) grade = 'B';
    else grade = 'C';
  }

  // Quality gate status
  let qgStatus: 'PASSED' | 'FAILED' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  let qgLabel = 'Not configured';
  let qgDescription = 'Connect a CI/CD quality gate to block vulnerabilities before deployment.';

  if (inputs.qualityGate?.policy) {
    const p = inputs.qualityGate.policy;
    // Check if evaluation was run or if fail conditions met
    const failsOnCrit = p.failOnCritical && crit > 0;
    const failsOnHigh = critHighCount > (p.maxHighFindings ?? 0);
    const failsOnScore = fleetScore !== null && fleetScore < (p.minSecurityScore ?? 80);

    if (failsOnCrit || failsOnHigh || failsOnScore) {
      qgStatus = 'FAILED';
      qgLabel = 'Failed';
      qgDescription = `Policy armed: min score ${p.minSecurityScore ?? 80}, max high ${p.maxHighFindings ?? 0}.`;
    } else {
      qgStatus = 'PASSED';
      qgLabel = 'Passed';
      qgDescription = `All targets comply with armed policy: min score ${p.minSecurityScore ?? 80}.`;
    }
  }

  // Health status
  let healthStatus: 'nominal' | 'degraded' | 'outage' = 'nominal';
  let healthLabel = 'Operational';
  if (inputs.health?.status === 'DOWN') {
    healthStatus = 'outage';
    healthLabel = 'System degraded';
  } else if (inputs.health?.status === 'DEGRADED') {
    healthStatus = 'degraded';
    healthLabel = 'Degraded';
  }

  // Top 3 open fixes (deduped by ruleId + endpoint)
  const openFindingsList = findingsList.filter((f) => isOpenFindingStatus(f.status));
  // Sort by severity weight
  const sevWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
  openFindingsList.sort((a, b) => (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0));

  const seenFixKeys = new Set<string>();
  const topFixes: OverviewData['topFixes'] = [];
  for (const f of openFindingsList) {
    const key = `${f.ruleId}::${f.resourceEndpoint || f.targetUrl}`;
    if (!seenFixKeys.has(key)) {
      seenFixKeys.add(key);
      topFixes.push({
        id: f.id,
        ruleId: f.ruleId,
        title: f.title,
        severity: f.severity,
        targetUrl: f.targetUrl,
        resourceEndpoint: f.resourceEndpoint,
      });
      if (topFixes.length >= 3) break;
    }
  }

  // Recent 5 scans
  const sortedScans = [...scansList].sort((a, b) => {
    const bTime = new Date(b.completedAt || b.createdAt).getTime();
    const aTime = new Date(a.completedAt || a.createdAt).getTime();
    return bTime - aTime;
  });
  const recentScans = sortedScans.slice(0, 5).map((s) => ({
    id: s.id,
    targetHostname: s.targetHostname || s.targetUrl?.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown',
    targetUrl: s.targetUrl,
    scanMode: s.scanMode,
    status: s.status,
    score: s.score,
    completedAt: s.completedAt,
    createdAt: s.createdAt,
  }));

  const isDataEmpty = targetsList.length === 0 && scansList.length === 0 && findingsList.length === 0;

  const scoreCalculationExplanation =
    'Security scores start at 100 per scan. Deductions are calculated per open issue: ' +
    'Critical -25, High -15, Medium -5, Low -2 (clamped 0–100). ' +
    'The fleet score is the arithmetic mean of the latest completed scan across all verified targets.';

  const data: OverviewData = {
    fleetScore,
    grade,
    headlineState,
    headlineTitle,
    headlineDescription,
    openFindings: {
      critical: crit,
      high,
      medium: med,
      low,
      total: totalOpen,
    },
    targetsCount: targetsList.length,
    verifiedTargetsCount,
    scansCount: scansList.length,
    completedScansCount: completedScans.length,
    qualityGate: {
      status: qgStatus,
      label: qgLabel,
      description: qgDescription,
    },
    health: {
      status: healthStatus,
      label: healthLabel,
    },
    topFixes,
    recentScans,
    scoreCalculationExplanation,
  };

  return {
    status: isDataEmpty ? 'empty' : 'ready',
    data,
  };
}

export function adaptNextBestAction(inputs: {
  targets?: any[] | null;
  scans?: any[] | null;
  findings?: any[] | null;
  qualityGatePolicy?: any | null;
  error?: string | null;
}): NextBestAction | null {
  if (inputs.error) {
    return null;
  }

  const targets = Array.isArray(inputs.targets) ? inputs.targets : [];
  const scans = Array.isArray(inputs.scans) ? inputs.scans : [];
  const findings = Array.isArray(inputs.findings) ? inputs.findings : [];

  // 1. No targets registered
  if (targets.length === 0) {
    return {
      actionId: 'add_target',
      title: 'Add your first site',
      description: 'Register an apex domain or service endpoint to start continuous perimeter monitoring.',
      href: '/dashboard/targets?new=true',
      cta: 'Add site',
    };
  }

  // 2. Targets exist but none verified
  const verifiedTarget = targets.find((t) => t.verificationStatus === 'VERIFIED');
  if (!verifiedTarget) {
    const unverified = targets[0];
    const host = unverified.hostname || unverified.targetUrl?.replace(/^https?:\/\//, '') || 'your domain';
    return {
      actionId: 'verify_target',
      title: `Verify ownership of ${host}`,
      description: 'Add a DNS TXT record or HTML meta tag to authorize active scanning and automated probes.',
      href: `/dashboard/targets/${unverified.id}/surface`,
      cta: 'Verify ownership',
      targetId: unverified.id,
    };
  }

  // 3. Verified target exists but no completed scan
  const completedScan = scans.find((s) => s.status === 'COMPLETED');
  if (!completedScan) {
    return {
      actionId: 'run_scan',
      title: 'Run your first scan',
      description: `Run a vulnerability scan against ${verifiedTarget.hostname || 'your verified site'} to detect secrets and misconfigurations.`,
      href: '/dashboard/scans',
      cta: 'Launch scan',
      targetId: verifiedTarget.id,
    };
  }

  // 4. Open Critical or High finding exists
  const openFindings = findings.filter(
    (f) =>
      isOpenFindingStatus(f.status) &&
      (f.severity === 'CRITICAL' || f.severity === 'HIGH')
  );
  if (openFindings.length > 0) {
    // Sort critical first
    openFindings.sort((a, b) => (b.severity === 'CRITICAL' ? 1 : 0) - (a.severity === 'CRITICAL' ? 1 : 0));
    const top = openFindings[0];
    return {
      actionId: 'fix_finding',
      title: `Fix the top issue: ${top.title}`,
      description: `${top.severity} severity issue detected on ${top.resourceEndpoint || top.targetUrl}. Review step-by-step remediation diffs.`,
      href: '/dashboard/findings',
      cta: 'See the fix',
      findingId: top.id,
    };
  }

  // 5. No CI quality gate configured
  if (!inputs.qualityGatePolicy) {
    return {
      actionId: 'add_ci_gate',
      title: 'Add a CI quality gate',
      description: 'Configure automated quality thresholds in GitHub Actions or GitLab to block vulnerable code before release.',
      href: '/dashboard/automation',
      cta: 'Set up gate',
    };
  }

  // 6. Otherwise: schedule recurring monitoring
  return {
    actionId: 'schedule_scan',
    title: 'Schedule weekly automated scan',
    description: 'Protect your production environment with automated weekly scans and regression alerts.',
    href: '/dashboard/automation',
    cta: 'Schedule scan',
  };
}

export function adaptTargetsTable(
  targets: any[] = [],
  scans: any[] = [],
  findings: any[] = []
): EnrichedTargetRow[] {
  return targets.map((target) => {
    // Latest completed scan for this target
    const targetScans = scans.filter(
      (s) => s.targetId === target.id || s.targetUrl === target.targetUrl
    );
    const completedScans = targetScans.filter((s) => s.status === 'COMPLETED');
    completedScans.sort((a, b) => {
      const bTime = new Date(b.completedAt || b.createdAt).getTime();
      const aTime = new Date(a.completedAt || a.createdAt).getTime();
      return bTime - aTime;
    });
    const latestCompleted = completedScans[0];

    // Latest scan overall
    targetScans.sort((a, b) => {
      const bTime = new Date(b.createdAt).getTime();
      const aTime = new Date(a.createdAt).getTime();
      return bTime - aTime;
    });
    const latestOverall = targetScans[0];

    // Open findings for this target
    const targetFindings = findings.filter(
      (f) => (f.targetId === target.id || f.targetUrl === target.targetUrl) && isOpenFindingStatus(f.status)
    );

    let crit = 0, high = 0, med = 0, low = 0;
    for (const f of targetFindings) {
      const sev = (f.severity || '').toUpperCase();
      if (sev === 'CRITICAL') crit++;
      else if (sev === 'HIGH') high++;
      else if (sev === 'MEDIUM') med++;
      else if (sev === 'LOW') low++;
    }

    return {
      targetId: target.id,
      hostname: target.hostname || target.targetUrl?.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown',
      targetUrl: target.targetUrl,
      verificationStatus: target.verificationStatus || 'PENDING',
      score: latestCompleted?.score !== undefined && latestCompleted?.score !== null ? Number(latestCompleted.score) : null,
      openIssues: {
        critical: crit,
        high,
        medium: med,
        low,
        total: crit + high + med + low,
      },
      lastScanTimestamp: latestOverall?.completedAt || latestOverall?.createdAt || null,
      lastScanStatus: latestOverall?.status || null,
      latestScanId: latestOverall?.id || null,
    };
  });
}

export function adaptFindingGroups(findings: any[] = []): {
  groups: FindingGroupItem[];
  stats: FindingsSeverityStats;
} {
  const groupsMap = new Map<string, FindingGroupItem>();

  let openCritHigh = 0;
  let needsTriage = 0;
  let acceptedRisk = 0;
  let fixedAndVerified = 0;

  for (const f of findings) {
    const status = (f.status || 'OPEN').toUpperCase();
    const sev = (f.severity || 'INFO').toUpperCase();

    if (isOpenFindingStatus(status)) {
      if (sev === 'CRITICAL' || sev === 'HIGH') openCritHigh++;
      else needsTriage++;
    } else if (status === 'ACCEPTED_RISK') {
      acceptedRisk++;
    } else if (status === 'FIXED') {
      fixedAndVerified++;
    }

    // Grouping key: target + ruleId + normalized endpoint path
    const endpoint = (f.resourceEndpoint || f.targetUrl || '/').trim();
    const normalizedPath = endpoint.replace(/https?:\/\/[^\/]+/, '') || '/';
    const groupKey = `${f.targetId || f.targetUrl}::${f.ruleId}::${normalizedPath.toLowerCase()}`;

    const existing = groupsMap.get(groupKey);
    const findingDate = new Date(f.createdAt || Date.now()).toISOString();

    if (!existing) {
      const confidence = f.confidence ? `${f.confidence.charAt(0).toUpperCase()}${f.confidence.slice(1).toLowerCase()}` : 'High';
      groupsMap.set(groupKey, {
        groupKey,
        ruleId: f.ruleId,
        title: f.title,
        severity: sev as any,
        confidenceLabel: `Confidence: ${confidence}`,
        endpoint,
        targetUrl: f.targetUrl,
        targetId: f.targetId,
        cweId: f.cweId || null,
        owaspCategory: f.owaspCategory || null,
        occurrenceCount: 1,
        firstSeenAt: findingDate,
        lastSeenAt: findingDate,
        latestFinding: f,
        occurrences: [f],
      });
    } else {
      existing.occurrenceCount++;
      existing.occurrences.push(f);
      if (new Date(findingDate).getTime() > new Date(existing.lastSeenAt).getTime()) {
        existing.lastSeenAt = findingDate;
        existing.latestFinding = f;
      }
      if (new Date(findingDate).getTime() < new Date(existing.firstSeenAt).getTime()) {
        existing.firstSeenAt = findingDate;
      }
    }
  }

  const groups = Array.from(groupsMap.values());
  const sevWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
  groups.sort((a, b) => (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0));

  return {
    groups,
    stats: {
      openCriticalHigh: openCritHigh,
      needsTriage,
      acceptedRisk,
      fixedAndVerified,
    },
  };
}

export function adaptNavBadges(inputs: {
  findings?: any[] | null;
  scans?: any[] | null;
  unreadAlertsCount?: number;
}): NavBadges {
  const findings = Array.isArray(inputs.findings) ? inputs.findings : [];
  const scans = Array.isArray(inputs.scans) ? inputs.scans : [];

  let openCriticalHigh = 0;
  for (const f of findings) {
    if (isOpenFindingStatus(f.status)) {
      const sev = (f.severity || '').toUpperCase();
      if (sev === 'CRITICAL' || sev === 'HIGH') {
        openCriticalHigh++;
      }
    }
  }

  const scansInProgress = scans.filter(
    (s) => s.status === 'QUEUED' || s.status === 'RUNNING'
  ).length;

  return {
    openCriticalHigh,
    scansInProgress,
    unreadAlerts: inputs.unreadAlertsCount || 0,
  };
}
