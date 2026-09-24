import {
  PLANS,
  PlanDefinition,
  PlanFeatures,
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
}

/**
 * Check if the requesting user has platform owner override privileges.
 */
export function isPlatformOwner(userRole?: string): boolean {
  return userRole === 'OWNER';
}

/**
 * Fetch the active plan definition for an organization.
 */
export async function getOrganizationPlan(organizationId: string): Promise<{
  subscription: SubscriptionRecord;
  plan: PlanDefinition;
}> {
  const subscription = await getSubscriptionByOrgId(organizationId);
  const plan = PLANS[subscription.planId] || PLANS.FREE_DEVELOPER;
  return { subscription, plan };
}

/**
 * Compile a comprehensive real-time entitlement and usage summary for an organization.
 */
export async function getOrganizationEntitlementSummary(
  organizationId: string,
  userRole?: string
): Promise<OrgEntitlementSummary> {
  const { subscription, plan } = await getOrganizationPlan(organizationId);
  const ownerBypass = isPlatformOwner(userRole);

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

  return {
    subscription,
    plan,
    isOwnerBypass: ownerBypass,
    usage: {
      targets: {
        current: targetsCount,
        max: ownerBypass ? 999999 : plan.limits.maxVerifiedTargets,
        percentage: ownerBypass ? 0 : calcPercentage(targetsCount, plan.limits.maxVerifiedTargets),
      },
      monthlyScans: {
        current: scansCount,
        max: ownerBypass ? 999999 : plan.limits.maxMonthlyScans,
        percentage: ownerBypass ? 0 : calcPercentage(scansCount, plan.limits.maxMonthlyScans),
      },
      teamMembers: {
        current: membersCount,
        max: ownerBypass ? 999999 : plan.limits.maxTeamMembers,
        percentage: ownerBypass ? 0 : calcPercentage(membersCount, plan.limits.maxTeamMembers),
      },
    },
    features: ownerBypass ? PLANS.ENTERPRISE.features : plan.features,
  };
}

/**
 * Enforce target creation quota.
 */
export async function checkTargetQuota(
  organizationId: string,
  userRole?: string
): Promise<QuotaCheckResult> {
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

  const { subscription, plan } = await getOrganizationPlan(organizationId);
  const current = await getActiveTargetCount(organizationId);
  const max = plan.limits.maxVerifiedTargets;

  if (current >= max) {
    return {
      allowed: false,
      metric: 'ACTIVE_TARGETS',
      current,
      max,
      planId: subscription.planId,
      isOwnerBypass: false,
      reason: `Organization has reached the verified target limit (${current}/${max}) for the ${plan.name} plan. Upgrade to expand your perimeter.`,
    };
  }

  return {
    allowed: true,
    metric: 'ACTIVE_TARGETS',
    current,
    max,
    planId: subscription.planId,
    isOwnerBypass: false,
  };
}

/**
 * Enforce monthly scan quota before launching scans.
 */
export async function checkScanQuota(
  organizationId: string,
  userRole?: string
): Promise<QuotaCheckResult> {
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

  const { subscription, plan } = await getOrganizationPlan(organizationId);
  const current = await getMonthlyScanUsage(organizationId);
  const max = plan.limits.maxMonthlyScans;

  if (current >= max) {
    return {
      allowed: false,
      metric: 'MONTHLY_SCANS',
      current,
      max,
      planId: subscription.planId,
      isOwnerBypass: false,
      reason: `Organization has reached the monthly scan allocation (${current}/${max}) for the ${plan.name} plan. Upgrade to unlock more scans.`,
    };
  }

  return {
    allowed: true,
    metric: 'MONTHLY_SCANS',
    current,
    max,
    planId: subscription.planId,
    isOwnerBypass: false,
  };
}

/**
 * Enforce feature entitlement access (e.g. audit vault, deep scans, crawler).
 */
export async function checkFeatureAccess(
  organizationId: string,
  feature: keyof PlanFeatures,
  userRole?: string
): Promise<FeatureAccessResult> {
  if (isPlatformOwner(userRole)) {
    return {
      allowed: true,
      feature,
      planId: 'ENTERPRISE',
      isOwnerBypass: true,
    };
  }

  const { subscription, plan } = await getOrganizationPlan(organizationId);
  const hasAccess = plan.features[feature] === true;

  if (!hasAccess) {
    return {
      allowed: false,
      feature,
      planId: subscription.planId,
      isOwnerBypass: false,
      reason: `Feature '${feature}' requires an upgraded plan. It is not included in ${plan.name}.`,
    };
  }

  return {
    allowed: true,
    feature,
    planId: subscription.planId,
    isOwnerBypass: false,
  };
}

/**
 * Increment and record scan usage after a scan is initiated.
 */
export async function recordScanUsage(organizationId: string): Promise<number> {
  return incrementMonthlyScans(organizationId, 1);
}
