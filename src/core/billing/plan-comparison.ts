import { PLANS, type PlanDefinition, type PlanId } from './types';
import { enginesForPlan } from '@/core/scanner/engine-registry';
export const PUBLIC_PLAN_IDS: readonly PlanId[] = ['STARTER', 'PRO', 'TEAM', 'ENTERPRISE'];
export type ComparisonCell = string | boolean;
const row = (name: string, value: (plan: PlanDefinition) => ComparisonCell) => ({ name, values: PUBLIC_PLAN_IDS.map((id) => value(PLANS[id])) });
const limit = (plan: PlanDefinition, amount: number, unit: string) => plan.id === 'ENTERPRISE' ? 'By agreement' : `${amount} ${unit}`;
/** All advertised numeric limits and included capabilities come from the entitlement definitions. */
export const PLAN_COMPARISON = [
  { group: 'Scanning and limits', rows: [
    row('Targets', p => limit(p,p.limits.maxSites,'targets')),
    row('Monthly scan allowance', p => limit(p,p.limits.maxMonthlyScans,'scans / month')),
    row('Included check engines', p => `${enginesForPlan(p.id).length} engines`),
    row('Active tests on verified targets', p => p.features.activeVerifiedTests),
    row('Crawl pages per assessment', p => p.limits.crawl.enabled ? limit(p,p.limits.crawl.maxPages,'pages') : false),
  ] },
  { group: 'Remediation and automation', rows: [
    row('Remediation code diffs', p => p.features.fixDiffs), row('Fix verification', p => p.features.fixRetests),
    row('Fix retests per finding each day', p => `${p.limits.fixRetestDailyCapPerFinding} retests`),
    row('Scheduled scanning', p => p.features.scheduledScans), row('Alerts', p => p.features.alerts),
    row('CI/CD quality gates', p => p.features.ciGates), row('SARIF exports', p => p.features.sarif),
    row('API keys', p => p.features.apiKeys), row('Signed webhooks', p => p.features.webhooks),
  ] },
  { group: 'Collaboration and governance', rows: [
    row('Team members', p => limit(p,p.limits.maxTeamMembers,'members')),
    row('Finding collaboration', p => p.features.findingCollaboration), row('Audit Vault and exports', p => p.features.auditVault),
    row('Agency workspace', p => p.features.agencyHub), row('History', p => `${p.limits.historyDays} days`),
  ] },
  { group: 'Roadmap — not included in current assessments', rows: [
    row('Authenticated scanning', () => 'Coming soon'), row('API schema fuzzing', () => 'Coming soon'),
    row('Repository and AI code analysis', () => 'Coming soon'),
  ] },
];
