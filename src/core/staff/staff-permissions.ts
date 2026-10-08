import { PLANS, PlanFeatures } from '@/core/billing/types';

export type StaffRole = 'STAFF_OWNER' | 'STAFF_ADMIN' | 'STAFF_SUPPORT';

export type StaffPermission =
  | 'CUSTOMER_PORTAL_ALL'
  | 'CUSTOMER_PORTAL_PRO'
  | 'VIEW_ORGS'
  | 'SUSPEND_ORGS'
  | 'VIEW_QUEUE'
  | 'VIEW_SECURITY_EVENTS'
  | 'GRANT_CREDITS'
  | 'MANAGE_STAFF'
  | 'SYSTEM_SETTINGS'
  | 'PLAN_PREVIEW_ANY'
  | 'PLAN_PREVIEW_PRO';

export const STAFF_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  STAFF_OWNER: [
    'CUSTOMER_PORTAL_ALL',
    'CUSTOMER_PORTAL_PRO',
    'VIEW_ORGS',
    'SUSPEND_ORGS',
    'VIEW_QUEUE',
    'VIEW_SECURITY_EVENTS',
    'GRANT_CREDITS',
    'MANAGE_STAFF',
    'SYSTEM_SETTINGS',
    'PLAN_PREVIEW_ANY',
    'PLAN_PREVIEW_PRO',
  ],
  STAFF_ADMIN: [
    'CUSTOMER_PORTAL_ALL',
    'CUSTOMER_PORTAL_PRO',
    'VIEW_ORGS',
    'SUSPEND_ORGS',
    'VIEW_QUEUE',
    'VIEW_SECURITY_EVENTS',
    'GRANT_CREDITS',
    'PLAN_PREVIEW_ANY',
    'PLAN_PREVIEW_PRO',
  ],
  STAFF_SUPPORT: [
    'CUSTOMER_PORTAL_PRO',
    'VIEW_ORGS',
    'VIEW_QUEUE',
    'VIEW_SECURITY_EVENTS',
    'PLAN_PREVIEW_PRO',
  ],
};

export interface StaffSessionUser {
  userId: string;
  role: StaffRole;
  email: string;
  displayName: string | null;
  lastReauthAt: Date;
  tokenHash: string;
}

/**
 * Central authorization gate for Staff capabilities.
 * Handlers and UI components MUST use `can(session, permission)`
 * and NEVER branch directly on role strings.
 */
export function can(
  session: { role?: StaffRole | null } | null | undefined,
  permission: StaffPermission
): boolean {
  if (!session || !session.role) return false;
  const permissions = STAFF_PERMISSIONS[session.role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Returns entitlements for staff members operating in the Customer Portal.
 * Support references the Pro plan directly so updates to Pro flow through.
 */
export function entitlementsForStaff(role: StaffRole): PlanFeatures {
  if (role === 'STAFF_SUPPORT') {
    return { ...PLANS.PRO.features };
  }
  // STAFF_OWNER and STAFF_ADMIN receive full platform enterprise capabilities
  return { ...PLANS.ENTERPRISE.features };
}

export const VALID_STAFF_ROLES: readonly StaffRole[] = [
  'STAFF_OWNER',
  'STAFF_ADMIN',
  'STAFF_SUPPORT',
];
