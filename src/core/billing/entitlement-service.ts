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
 * Check if the requesting user has platform owner override privileges.
 */
export function isPlatformOwner(userRole?: string): boolean {
  return userRole === 'OWNER' || userRole === 'STAFF_OWNER';
}

/**
 * Pure synchronous resolver for entitlements from a plan identifier (§F3).
 */
export function resolveEntitlementsFromPlan(
  planInput: PlanId | string,
  options?: { isStaffOverride?: boolean; previewPlanId?: PlanId | null }
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
    isStaffOverride: options?.isStaffOverride ?? false,
    previewPlanId: options?.previewPlanId ?? null,
  };
}

/**
 * Centrally resolves plan limits, feature flags, and allowed engine IDs (§F3).
 * Prioritizes staff overrides and session preview plans before organization defaults.
 * No `if (plan === 'pro')` anywhere.
 */
export async function resolveEntitlements(
  org?: { id?: string; planId?: string | null; isInternal?: boolean } | string | null,
  session?: SessionContext | null
): Promise<ResolvedEntitlements> {
  // 1. Staff session overrides (preview plan or platform role)
  if (session?.viaStaffPortal) {
    if (session.previewPlanId) {
      const previewPlan = resolvePlanId(session.previewPlanId);
      return resolveEntitlementsFromPlan(previewPlan, {
        isStaffOverride: true,
        previewPlanId: previewPlan,
      });
    }

    if (session.staffRole === 'STAFF_SUPPORT') {
      return resolveEntitlementsFromPlan('PRO', { isStaffOverride: true });
    }

    if (
      session.staffRole === 'STAFF_OWNER' ||
      session.staffRole === 'STAFF_ADMIN' ||
      session.user?.role === 'OWNER'
    ) {
      return resolveEntitlementsFromPlan('ENTERPRISE', { isStaffOverride: true });
    }
  }

  // 2. Platform owner override on customer session
  if (session?.user?.role === 'OWNER') {
    return resolveEntitlementsFromPlan('ENTERPRISE', { isStaffOverride: true });
  }

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
    return resolveEntitlementsFromPlan(subscription.planId);
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
  const userRole = typeof userRoleOrSession === 'string' ? userRoleOrSession : session?.user?.role;
  const entitlements = await resolveEntitlements(organizationId, session);
  const subscription = await getSubscriptionByOrgId(organizationId);
  const ownerBypass = isPlatformOwner(userRole) || entitlements.isStaffOverride;

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

  const targetLimit = ownerBypass ? 999999 : entitlements.limits.maxSites;
  const scanLimit = ownerBypass ? 999999 : entitlements.limits.maxMonthlyScans;
  const memberLimit = ownerBypass ? 999999 : entitlements.limits.maxTeamMembers;

  return {
    subscription,
    plan: entitlements.plan,
    isOwnerBypass: ownerBypass,
    usage: {
      targets: {
        current: targetsCount,
        max: targetLimit,
        percentage: ownerBypass ? 0 : calcPercentage(targetsCount, targetLimit),
      },
      monthlyScans: {
        current: scansCount,
        max: scanLimit,
        percentage: ownerBypass ? 0 : calcPercentage(scansCount, scanLimit),
      },
      teamMembers: {
        current: membersCount,
        max: memberLimit,
        percentage: ownerBypass ? 0 : calcPercentage(membersCount, memberLimit),
      },
    },
    features: ownerBypass ? PLANS.ENTERPRISE.features : entitlements.features,
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
  const userRole = typeof userRoleOrSession === 'string' ? userRoleOrSession : session?.user?.role;

  if (isPlatformOwner(userRole)) {
    return {
      allowed: true,
      metric: 'ACTIVE_TARGETS',
      current: 0,
      max: 999999,
      planId: 'ENTERPRISE',
      isOwnerBypass: true,
    };
  }

  const entitlements = await resolveEntitlements(organizationId, session);
  if (entitlements.isStaffOverride && entitlements.limits.maxSites >= 999999) {
    return {
      allowed: true,
      metric: 'ACTIVE_TARGETS',
      current: 0,
      max: 999999,
      planId: entitlements.planId,
      isOwnerBypass: true,
    };
  }

  const subscription = await getSubscriptionByOrgId(organizationId).catch(() => null);
  const current = await getActiveTargetCount(organizationId);
  const max = entitlements.limits.maxSites;

  if (current >= max && !entitlements.isStaffOverride) {
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
  const userRole = typeof userRoleOrSession === 'string' ? userRoleOrSession : session?.user?.role;

  if (isPlatformOwner(userRole)) {
    return {
      allowed: true,
      metric: 'MONTHLY_SCANS',
      current: 0,
      max: 999999,
      planId: 'ENTERPRISE',
      isOwnerBypass: true,
    };
  }

  const entitlements = await resolveEntitlements(organizationId, session);
  if (entitlements.isStaffOverride && entitlements.limits.maxMonthlyScans >= 999999) {
    return {
      allowed: true,
      metric: 'MONTHLY_SCANS',
      current: 0,
      max: 999999,
      planId: entitlements.planId,
      isOwnerBypass: true,
    };
  }

  const subscription = await getSubscriptionByOrgId(organizationId).catch(() => null);
  const current = await getMonthlyScanUsage(organizationId);
  const max = entitlements.limits.maxMonthlyScans;

  if (current >= max && !entitlements.isStaffOverride) {
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
  const userRole = typeof userRoleOrSession === 'string' ? userRoleOrSession : session?.user?.role;

  if (isPlatformOwner(userRole)) {
    return {
      allowed: true,
      feature,
      planId: 'ENTERPRISE',
      isOwnerBypass: true,
    };
  }

  const entitlements = await resolveEntitlements(organizationId, session);
  const subscription = await getSubscriptionByOrgId(organizationId).catch(() => null);
  const hasAccess = entitlements.features[feature] === true;

  if (!hasAccess && !entitlements.isStaffOverride) {
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
    isOwnerBypass: entitlements.isStaffOverride,
  };
}

/**
 * Increment and record scan usage after a scan is initiated.
 */
export async function recordScanUsage(organizationId: string): Promise<number> {
  return incrementMonthlyScans(organizationId, 1);
}
