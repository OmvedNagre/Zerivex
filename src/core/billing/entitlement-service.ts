import { getCreditLedger } from '@/core/credits/credit-service';
import {
  PLANS,
  PlanDefinition,
  PlanFeatures,
  PlanLimits,
  PlanId,
  resolvePlanId,
  QuotaCheckResult,
  FeatureAccessResult,
  SubscriptionRecord,
} from './types';
import {
  getSubscriptionByOrgId,
  getActiveTargetCount,
  getMonthlyScanUsage,
  getTeamMemberCount,
  incrementMonthlyScans,
} from './subscription-repository';
import { enginesForPlan } from '@/core/scanner/engine-registry';
import { SessionContext } from '@/core/auth/session-service';

export interface ResolvedEntitlements {
  planId: PlanId;
  plan: PlanDefinition;
  limits: PlanLimits;
  features: PlanFeatures;
  engineIds: string[];
  isStaffOverride: boolean;
  previewPlanId?: PlanId | null;
}

export interface OrgEntitlementSummary {
  scanCredits: number;
  subscription: SubscriptionRecord;
  plan: PlanDefinition;
  isOwnerBypass: boolean;
  usage: {
    targets: { current: number; max: number; percentage: number };
    monthlyScans: { current: number; max: number; percentage: number };
    teamMembers: { current: number; max: number; percentage: number };
  };
  features: PlanFeatures;
  engineIds: string[];
}


/**
 * Pure synchronous resolver for entitlements from a plan identifier (§F3).
 */
export function resolveEntitlementsFromPlan(
  planInput: PlanId | string,
  _options?: { isStaffOverride?: boolean; previewPlanId?: PlanId | null }
): ResolvedEntitlements {
  const planId = resolvePlanId(planInput);
  const plan = PLANS[planId] || PLANS.STARTER;
  const engineDefs = enginesForPlan(planId);

  return {
    planId,
    plan,
    limits: plan.limits,
    features: plan.features,
    engineIds: engineDefs.map((e) => e.id),
    isStaffOverride: false,
    previewPlanId: null,
  };
}

/**
 * Centrally resolves plan limits, feature flags, and allowed engine IDs (§F3).
 * Customer entitlements always follow the organization subscription, regardless of staff role.
 * No `if (plan === 'pro')` anywhere.
 */
export async function resolveEntitlements(
  org?: { id?: string; planId?: string | null; isInternal?: boolean } | string | null,
  session?: SessionContext | null
): Promise<ResolvedEntitlements> {
  // 3. Directly passed plan name or legacy alias
  if (typeof org === 'string' && (org in PLANS || org === 'FREE_DEVELOPER' || org === 'TEAM_PRO')) {
    return resolveEntitlementsFromPlan(org);
  }

  // 4. Object with pre-resolved planId
  if (typeof org === 'object' && org !== null && org.planId) {
    return resolveEntitlementsFromPlan(org.planId);
  }

  // 5. Query subscription for organizationId
  const orgId = typeof org === 'string' ? org : org?.id || session?.organizationId;
  if (orgId) {
    const subscription = await getSubscriptionByOrgId(orgId);
    const active = ['ACTIVE', 'TRIALING'].includes(subscription.status) &&
      (resolvePlanId(subscription.planId) === 'STARTER' || new Date(subscription.currentPeriodEnd).getTime() > Date.now());
    return resolveEntitlementsFromPlan(active ? subscription.planId : 'STARTER');
  }

  // 6. Default to Starter tier
  return resolveEntitlementsFromPlan('STARTER');
}

/**
 * Fetch the active plan definition and resolved entitlements for an organization.
 */
export async function getOrganizationPlan(
  organizationId: string,
  session?: SessionContext | null
): Promise<{
  subscription: SubscriptionRecord;
  plan: PlanDefinition;
  entitlements: ResolvedEntitlements;
}> {
  const subscription = await getSubscriptionByOrgId(organizationId);
  const entitlements = await resolveEntitlements(organizationId, session);
  return { subscription, plan: entitlements.plan, entitlements };
}

/**
 * Compile a comprehensive real-time entitlement and usage summary for an organization.
 */
export async function getOrganizationEntitlementSummary(
  organizationId: string,
  userRoleOrSession?: string | SessionContext | null
): Promise<OrgEntitlementSummary> {
  const session = typeof userRoleOrSession === 'object' ? userRoleOrSession : null;
  const entitlements = await resolveEntitlements(organizationId, session);
  const subscription = await getSubscriptionByOrgId(organizationId);

  const [targetsCount, scansCount, membersCount] = await Promise.all([
    getActiveTargetCount(organizationId),
    getMonthlyScanUsage(organizationId),
    getTeamMemberCount(organizationId),
  ]);

  const calcPercentage = (curr: number, max: number): number => {
    if (max >= 999999) return 0;
    if (max === 0) return 100;
    return Math.min(100, Math.round((curr / max) * 100));
  };

  const targetLimit = entitlements.limits.maxSites;
  const scanLimit = entitlements.limits.maxMonthlyScans;
  const memberLimit = entitlements.limits.maxTeamMembers;

  return {
    scanCredits: (await getCreditLedger(organizationId)).balance,
    subscription,
    plan: entitlements.plan,
    isOwnerBypass: false,
    usage: {
      targets: {
        current: targetsCount,
        max: targetLimit,
        percentage: calcPercentage(targetsCount, targetLimit),
      },
      monthlyScans: {
        current: scansCount,
        max: scanLimit,
        percentage: calcPercentage(scansCount, scanLimit),
      },
      teamMembers: {
        current: membersCount,
        max: memberLimit,
        percentage: calcPercentage(membersCount, memberLimit),
      },
    },
    features: entitlements.features,
    engineIds: entitlements.engineIds,
  };
}

/**
 * Enforce target creation quota.
 */
export async function checkTargetQuota(
  organizationId: string,
  userRoleOrSession?: string | SessionContext | null
): Promise<QuotaCheckResult> {
  const session = typeof userRoleOrSession === 'object' ? userRoleOrSession : null;



  const entitlements = await resolveEntitlements(organizationId, session);


  const subscription = await getSubscriptionByOrgId(organizationId).catch(() => null);
  const current = await getActiveTargetCount(organizationId);
  const max = entitlements.limits.maxSites;

  if (current >= max) {
    return {
      allowed: false,
      metric: 'ACTIVE_TARGETS',
      current,
      max,
      planId: subscription?.planId || entitlements.planId,
      isOwnerBypass: false,
      reason: `Organization has reached the verified target limit (${current}/${max}) for the ${entitlements.plan.name} plan. Upgrade to expand your perimeter.`,
    };
  }

  return {
    allowed: true,
    metric: 'ACTIVE_TARGETS',
    current,
    max,
    planId: subscription?.planId || entitlements.planId,
    isOwnerBypass: false,
  };
}

/**
 * Enforce monthly scan quota before launching scans.
 */
export async function checkScanQuota(
  organizationId: string,
  userRoleOrSession?: string | SessionContext | null
): Promise<QuotaCheckResult> {
  const session = typeof userRoleOrSession === 'object' ? userRoleOrSession : null;



  const entitlements = await resolveEntitlements(organizationId, session);


  const subscription = await getSubscriptionByOrgId(organizationId).catch(() => null);
  const current = await getMonthlyScanUsage(organizationId);
  const max = entitlements.limits.maxMonthlyScans;

  if (current >= max) {
    return {
      allowed: false,
      metric: 'MONTHLY_SCANS',
      current,
      max,
      planId: subscription?.planId || entitlements.planId,
      isOwnerBypass: false,
      reason: `Organization has reached the monthly scan allocation (${current}/${max}) for the ${entitlements.plan.name} plan. Upgrade to unlock more scans.`,
    };
  }

  return {
    allowed: true,
    metric: 'MONTHLY_SCANS',
    current,
    max,
    planId: subscription?.planId || entitlements.planId,
    isOwnerBypass: false,
  };
}

/**
 * Enforce feature entitlement access (e.g. audit vault, deep scans, crawler).
 */
export async function checkFeatureAccess(
  organizationId: string,
  feature: keyof PlanFeatures,
  userRoleOrSession?: string | SessionContext | null
): Promise<FeatureAccessResult> {
  const session = typeof userRoleOrSession === 'object' ? userRoleOrSession : null;



  const entitlements = await resolveEntitlements(organizationId, session);
  const subscription = await getSubscriptionByOrgId(organizationId).catch(() => null);
  const hasAccess = entitlements.features[feature] === true;

  if (!hasAccess) {
    return {
      allowed: false,
      feature,
      planId: subscription?.planId || entitlements.planId,
      isOwnerBypass: false,
      reason: `Feature '${feature}' requires an upgraded plan. It is not included in ${entitlements.plan.name}.`,
    };
  }

  return {
    allowed: true,
    feature,
    planId: subscription?.planId || entitlements.planId,
    isOwnerBypass: false,
  };
}

/**
 * Increment and record scan usage after a scan is initiated.
 */
export async function recordScanUsage(organizationId: string): Promise<number> {
  return incrementMonthlyScans(organizationId, 1);
}
