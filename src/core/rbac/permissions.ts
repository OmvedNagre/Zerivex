/**
 * Platform Roles & Capability-Based Permissions Matrix
 */

export type PlatformRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'USER';

export type OrganizationRole = 'ORG_OWNER' | 'ORG_ADMIN' | 'ORG_MEMBER';

export type Permission =
  | 'scans:create'
  | 'scans:read'
  | 'scans:cancel'
  | 'targets:create'
  | 'targets:read'
  | 'targets:update'
  | 'targets:delete'
  | 'targets:verify'
  | 'findings:read'
  | 'findings:update'
  | 'audit:read'
  | 'users:read'
  | 'users:manage'
  | 'platform:admin'
  | 'platform:rules_manage'
  | 'schedules:create'
  | 'schedules:read'
  | 'schedules:update'
  | 'schedules:delete'
  | 'monitoring:read';

/**
 * Platform role permissions map.
 * The OWNER role receives all permissions implicitly via server policy.
 */
export const ROLE_PERMISSIONS: Record<PlatformRole, readonly Permission[]> = {
  OWNER: [
    'scans:create',
    'scans:read',
    'scans:cancel',
    'targets:create',
    'targets:read',
    'targets:update',
    'targets:delete',
    'targets:verify',
    'findings:read',
    'findings:update',
    'audit:read',
    'users:read',
    'users:manage',
    'platform:admin',
    'platform:rules_manage',
    'schedules:create',
    'schedules:read',
    'schedules:update',
    'schedules:delete',
    'monitoring:read',
  ],
  SUPER_ADMIN: [
    'scans:create',
    'scans:read',
    'scans:cancel',
    'targets:create',
    'targets:read',
    'targets:update',
    'targets:delete',
    'targets:verify',
    'findings:read',
    'findings:update',
    'audit:read',
    'users:read',
    'users:manage',
    'platform:admin',
    'schedules:create',
    'schedules:read',
    'schedules:update',
    'schedules:delete',
    'monitoring:read',
  ],
  ADMIN: [
    'scans:create',
    'scans:read',
    'scans:cancel',
    'targets:create',
    'targets:read',
    'targets:update',
    'targets:delete',
    'targets:verify',
    'findings:read',
    'findings:update',
    'audit:read',
    'users:read',
    'schedules:create',
    'schedules:read',
    'schedules:update',
    'schedules:delete',
    'monitoring:read',
  ],
  SUPPORT: [
    'scans:read',
    'targets:read',
    'findings:read',
    'audit:read',
    'users:read',
    'schedules:read',
    'monitoring:read',
  ],
  USER: [
    'scans:create',
    'scans:read',
    'scans:cancel',
    'targets:create',
    'targets:read',
    'targets:update',
    'targets:delete',
    'targets:verify',
    'findings:read',
    'findings:update',
    'schedules:create',
    'schedules:read',
    'schedules:update',
    'schedules:delete',
    'monitoring:read',
  ],
};

/**
 * Check whether a platform role possesses a specific permission.
 */
export function roleHasPermission(role: PlatformRole, permission: Permission): boolean {
  if (role === 'OWNER') {
    return true; // Owner possesses all platform capabilities
  }
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
