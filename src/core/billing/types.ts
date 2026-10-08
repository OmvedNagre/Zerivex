/**
 * Core Types & Plan Definitions for Zerivex Billing, Entitlements & Engine Tiering.
 * Currency is strictly INR (₹) across all plan tiers and checkout workflows.
 *
 * Implements Phase F1 Specification: Single Plan Config
 * Plans: Starter (₹0) · Pro (₹1,499) · Team (₹4,999) · Enterprise (Custom)
 */

export type PlanId = 'STARTER' | 'PRO' | 'TEAM' | 'ENTERPRISE';

export const PLAN_RANK: Record<PlanId, number> = {
  STARTER: 1,
  PRO: 2,
  TEAM: 3,
  ENTERPRISE: 4,
};

export const LEGACY_PLAN_ALIASES: Record<string, PlanId> = {
  FREE_DEVELOPER: 'STARTER',
  STARTER: 'STARTER',
  TEAM_PRO: 'TEAM',
  PRO: 'PRO',
  TEAM: 'TEAM',
  ENTERPRISE: 'ENTERPRISE',
};

export function resolvePlanId(id?: string | null): PlanId {
  if (!id) return 'STARTER';
  return LEGACY_PLAN_ALIASES[id] || (id as PlanId) || 'STARTER';
}

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export type UsageMetric = 'MONTHLY_SCANS' | 'ACTIVE_TARGETS' | 'TEAM_MEMBERS';

export interface PlanPricing {
  monthlyInr: number;
  yearlyInr: number;
  currency: 'INR';
}

export interface PlanLimits {
  maxSites: number;
  maxMonthlyScans: number;
  maxTeamMembers: number;
  historyDays: number;
  crawl: { enabled: boolean; maxDepth: number; maxPages: number };
  fixRetestDailyCapPerFinding: number;
  // Legacy alias for compatibility
  maxVerifiedTargets: number;
}

export interface PlanFeatures {
  fixDiffs: boolean;
  fixRetests: boolean;
  activeVerifiedTests: boolean;
  scheduledScans: boolean;
  alerts: boolean;
  findingCollaboration: boolean;
  ciGates: boolean;
  sarif: boolean;
  webhooks: boolean;
  apiKeys: boolean;
  auditVault: boolean;
  agencyHub: boolean;

  // Legacy aliases for backward compatibility with existing components & tests
  attackSurfaceCrawler: boolean;
  cicdIntegrations: boolean;
  continuousMonitoring: boolean;
  complianceAuditVault: boolean;
  deepActiveScans: boolean;
  logRetentionDays: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  badge?: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeatures;
  display?: { highlighted?: boolean };
}

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  planId: PlanId | string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currency: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  legacyPlanId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageLedgerRecord {
  id: string;
  organizationId: string;
  metric: UsageMetric;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotaCheckResult {
  allowed: boolean;
  metric: UsageMetric | string;
  current: number;
  max: number;
  planId: PlanId | string;
  isOwnerBypass: boolean;
  reason?: string;
}

export interface FeatureAccessResult {
  allowed: boolean;
  feature: keyof PlanFeatures;
  planId: PlanId | string;
  isOwnerBypass: boolean;
  reason?: string;
}

/**
 * Canonical Plans Matrix in INR (Indian Rupees ₹)
 * Single Source of Truth (§F1)
 */
export const PLANS: Record<PlanId, PlanDefinition> & {
  // Legacy aliases
  FREE_DEVELOPER: PlanDefinition;
  TEAM_PRO: PlanDefinition;
} = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Essential perimeter security and passive checks for individual developers and AI-built projects.',
    pricing: {
      monthlyInr: 0,
      yearlyInr: 0,
      currency: 'INR',
    },
    limits: {
      maxSites: 1,
      maxMonthlyScans: 8,
      maxTeamMembers: 1,
      historyDays: 30,
      crawl: { enabled: false, maxDepth: 0, maxPages: 0 },
      fixRetestDailyCapPerFinding: 10,
      maxVerifiedTargets: 1,
    },
    features: {
      fixDiffs: true,
      fixRetests: true,
      activeVerifiedTests: false,
      scheduledScans: false,
      alerts: false,
      findingCollaboration: false,
      ciGates: false,
      sarif: false,
      webhooks: false,
      apiKeys: false,
      auditVault: false,
      agencyHub: false,

      // Legacy
      attackSurfaceCrawler: false,
      cicdIntegrations: false,
      continuousMonitoring: false,
      complianceAuditVault: false,
      deepActiveScans: false,
      logRetentionDays: 30,
    },
    display: { highlighted: false },
  },

  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'Full 14-engine battery including active verified probes, crawler reconnaissance, and fix verification.',
    badge: 'RECOMMENDED',
    pricing: {
      monthlyInr: 1499,
      yearlyInr: 14990, // ~17% annual discount (2 months free)
      currency: 'INR',
    },
    limits: {
      maxSites: 3,
      maxMonthlyScans: 50,
      maxTeamMembers: 3,
      historyDays: 90,
      crawl: { enabled: true, maxDepth: 2, maxPages: 15 },
      fixRetestDailyCapPerFinding: 10,
      maxVerifiedTargets: 3,
    },
    features: {
      fixDiffs: true,
      fixRetests: true,
      activeVerifiedTests: true,
      scheduledScans: true,
      alerts: true,
      findingCollaboration: true,
      ciGates: false,
      sarif: false,
      webhooks: false,
      apiKeys: false,
      auditVault: false,
      agencyHub: false,

      // Legacy
      attackSurfaceCrawler: true,
      cicdIntegrations: false,
      continuousMonitoring: true,
      complianceAuditVault: false,
      deepActiveScans: true,
      logRetentionDays: 90,
    },
    display: { highlighted: true },
  },

  TEAM: {
    id: 'TEAM',
    name: 'Team',
    tagline: 'Multi-target fleet protection, CI/CD gates, SARIF export, webhooks, and team collaboration.',
    pricing: {
      monthlyInr: 4999,
      yearlyInr: 49990, // 2 months free
      currency: 'INR',
    },
    limits: {
      maxSites: 15,
      maxMonthlyScans: 250,
      maxTeamMembers: 10,
      historyDays: 365,
      crawl: { enabled: true, maxDepth: 4, maxPages: 50 },
      fixRetestDailyCapPerFinding: 25,
      maxVerifiedTargets: 15,
    },
    features: {
      fixDiffs: true,
      fixRetests: true,
      activeVerifiedTests: true,
      scheduledScans: true,
      alerts: true,
      findingCollaboration: true,
      ciGates: true,
      sarif: true,
      webhooks: true,
      apiKeys: true,
      auditVault: true,
      agencyHub: true,

      // Legacy
      attackSurfaceCrawler: true,
      cicdIntegrations: true,
      continuousMonitoring: true,
      complianceAuditVault: false,
      deepActiveScans: true,
      logRetentionDays: 365,
    },
    display: { highlighted: false },
  },

  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Custom limits, dedicated support, organization-wide governance, and bespoke compliance reporting.',
    badge: 'ENTERPRISE COMPLIANCE',
    pricing: {
      monthlyInr: 0,
      yearlyInr: 0,
      currency: 'INR',
    },
    limits: {
      maxSites: 999999,
      maxMonthlyScans: 999999,
      maxTeamMembers: 999999,
      historyDays: 730,
      crawl: { enabled: true, maxDepth: 10, maxPages: 200 },
      fixRetestDailyCapPerFinding: 100,
      maxVerifiedTargets: 999999,
    },
    features: {
      fixDiffs: true,
      fixRetests: true,
      activeVerifiedTests: true,
      scheduledScans: true,
      alerts: true,
      findingCollaboration: true,
      ciGates: true,
      sarif: true,
      webhooks: true,
      apiKeys: true,
      auditVault: true,
      agencyHub: true,

      // Legacy
      attackSurfaceCrawler: true,
      cicdIntegrations: true,
      continuousMonitoring: true,
      complianceAuditVault: true,
      deepActiveScans: true,
      logRetentionDays: 730,
    },
    display: { highlighted: false },
  },

  // Legacy mappings for backward compatibility
  get FREE_DEVELOPER() {
    return this.STARTER;
  },
  get TEAM_PRO() {
    return this.TEAM;
  },
};
