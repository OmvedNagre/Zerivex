/**
 * Core Types & Plan Definitions for Zerivex Billing & Entitlements Engine.
 * Currency is strictly INR (₹) across all plan tiers and checkout workflows.
 */

export type PlanId = 'FREE_DEVELOPER' | 'TEAM_PRO' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export type UsageMetric = 'MONTHLY_SCANS' | 'ACTIVE_TARGETS' | 'TEAM_MEMBERS';

export interface PlanPricing {
  monthlyInr: number;
  yearlyInr: number;
  currency: 'INR';
}

export interface PlanFeatures {
  attackSurfaceCrawler: boolean;
  cicdIntegrations: boolean;
  continuousMonitoring: boolean;
  complianceAuditVault: boolean;
  findingCollaboration: boolean;
  deepActiveScans: boolean;
  logRetentionDays: number;
}

export interface PlanLimits {
  maxVerifiedTargets: number;
  maxMonthlyScans: number;
  maxTeamMembers: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  badge?: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeatures;
}

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currency: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
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
  planId: PlanId;
  isOwnerBypass: boolean;
  reason?: string;
}

export interface FeatureAccessResult {
  allowed: boolean;
  feature: keyof PlanFeatures;
  planId: PlanId;
  isOwnerBypass: boolean;
  reason?: string;
}

/**
 * Canonical Plans Matrix in INR (Indian Rupees ₹)
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE_DEVELOPER: {
    id: 'FREE_DEVELOPER',
    name: 'Free Developer',
    tagline: 'Essential perimeter reconnaissance for individual developers & security enthusiasts.',
    pricing: {
      monthlyInr: 0,
      yearlyInr: 0,
      currency: 'INR',
    },
    limits: {
      maxVerifiedTargets: 1,
      maxMonthlyScans: 10,
      maxTeamMembers: 1,
    },
    features: {
      attackSurfaceCrawler: false,
      cicdIntegrations: false,
      continuousMonitoring: false,
      complianceAuditVault: false,
      findingCollaboration: false,
      deepActiveScans: false,
      logRetentionDays: 7,
    },
  },
  TEAM_PRO: {
    id: 'TEAM_PRO',
    name: 'Team Pro',
    tagline: 'Deep active scanning, automated crawlers, and CI/CD quality gates for agile security teams.',
    badge: 'MOST POPULAR',
    pricing: {
      monthlyInr: 3999,
      yearlyInr: 39990, // ~17% annual discount (2 months free)
      currency: 'INR',
    },
    limits: {
      maxVerifiedTargets: 5,
      maxMonthlyScans: 250,
      maxTeamMembers: 5,
    },
    features: {
      attackSurfaceCrawler: true,
      cicdIntegrations: true,
      continuousMonitoring: true,
      complianceAuditVault: false,
      findingCollaboration: true,
      deepActiveScans: true,
      logRetentionDays: 30,
    },
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Continuous monitoring, cryptographic audit vaults, and unlimited scale for mission-critical security.',
    badge: 'ENTERPRISE COMPLIANCE',
    pricing: {
      monthlyInr: 19999,
      yearlyInr: 199990, // ~17% annual discount (2 months free)
      currency: 'INR',
    },
    limits: {
      maxVerifiedTargets: 999999,
      maxMonthlyScans: 999999,
      maxTeamMembers: 999999,
    },
    features: {
      attackSurfaceCrawler: true,
      cicdIntegrations: true,
      continuousMonitoring: true,
      complianceAuditVault: true,
      findingCollaboration: true,
      deepActiveScans: true,
      logRetentionDays: 365,
    },
  },
};
