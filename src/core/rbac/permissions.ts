/**
 * Platform Roles & Capability-Based Permissions Matrix
 */

export type PlatformRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'USER';

export type OrganizationRole = 'ORG_OWNER' | 'ORG_ADMIN' | 'ORG_MEMBER' | 'ORG_VIEWER' | 'ORG_AUDITOR';

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
  | 'monitoring:read'
  | 'apikeys:create'
  | 'apikeys:read'
  | 'apikeys:revoke'
  | 'webhooks:create'
  | 'webhooks:read'
  | 'webhooks:update'
  | 'webhooks:delete'
  | 'ci:execute'
  | 'qualitygate:manage'
  | 'org:manage'
  | 'org:invite'
  | 'org:members_read'
  | 'org:members_manage'
  | 'audit:export'
  | 'findings:comment'
  | 'findings:assign'
  | 'billing:read'
  | 'billing:manage'
  | 'agency:read'
  | 'agency:manage'
  | 'agency:branding_manage'
  | 'agency:clients_manage';

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
    'apikeys:create',
    'apikeys:read',
    'apikeys:revoke',
    'webhooks:create',
    'webhooks:read',
    'webhooks:update',
    'webhooks:delete',
    'ci:execute',
    'qualitygate:manage',
    'org:manage',
    'org:invite',
    'org:members_read',
    'org:members_manage',
    'audit:export',
    'findings:comment',
    'findings:assign',
    'billing:read',
    'billing:manage',
    'agency:read',
    'agency:manage',
    'agency:branding_manage',
    'agency:clients_manage',
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
    'apikeys:create',
    'apikeys:read',
    'apikeys:revoke',
    'webhooks:create',
    'webhooks:read',
    'webhooks:update',
    'webhooks:delete',
    'ci:execute',
    'qualitygate:manage',
    'org:manage',
    'org:invite',
    'org:members_read',
    'org:members_manage',
    'findings:comment',
    'findings:assign',
    'billing:read',
    'billing:manage',
    'agency:read',
    'agency:manage',
    'agency:branding_manage',
    'agency:clients_manage',
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
    'apikeys:create',
    'apikeys:read',
    'apikeys:revoke',
    'webhooks:create',
    'webhooks:read',
    'webhooks:update',
    'webhooks:delete',
    'ci:execute',
    'qualitygate:manage',
    'org:manage',
    'org:invite',
    'org:members_read',
    'org:members_manage',
    'audit:export',
    'findings:comment',
    'findings:assign',
    'billing:read',
    'agency:read',
    'agency:branding_manage',
    'agency:clients_manage',
  ],
  SUPPORT: [
    'scans:read',
    'targets:read',
    'findings:read',
    'audit:read',
    'users:read',
    'schedules:read',
    'monitoring:read',
    'apikeys:read',
    'webhooks:read',
    'org:members_read',
    'audit:export',
    'billing:read',
    'agency:read',
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
    'apikeys:create',
    'apikeys:read',
    'apikeys:revoke',
    'webhooks:create',
    'webhooks:read',
    'webhooks:update',
    'webhooks:delete',
    'ci:execute',
    'qualitygate:manage',
    'org:manage',
    'org:invite',
    'org:members_read',
    'org:members_manage',
    'audit:export',
    'findings:comment',
    'findings:assign',
    'billing:read',
    'billing:manage',
    'agency:read',
    'agency:manage',
    'agency:branding_manage',
    'agency:clients_manage',
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

/**
 * Organization Role Capability Mapping
 */
export const ORG_ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  ORG_OWNER: [
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
    'schedules:create',
    'schedules:read',
    'schedules:update',
    'schedules:delete',
    'monitoring:read',
    'apikeys:create',
    'apikeys:read',
    'apikeys:revoke',
    'webhooks:create',
    'webhooks:read',
    'webhooks:update',
    'webhooks:delete',
    'ci:execute',
    'qualitygate:manage',
    'org:manage',
    'org:invite',
    'org:members_read',
    'org:members_manage',
    'audit:export',
    'findings:comment',
    'findings:assign',
    'billing:read',
    'billing:manage',
    'agency:read',
    'agency:manage',
    'agency:branding_manage',
    'agency:clients_manage',
  ],
  ORG_ADMIN: [
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
    'schedules:create',
    'schedules:read',
    'schedules:update',
    'schedules:delete',
    'monitoring:read',
    'apikeys:create',
    'apikeys:read',
    'apikeys:revoke',
    'webhooks:create',
    'webhooks:read',
    'webhooks:update',
    'webhooks:delete',
    'ci:execute',
    'qualitygate:manage',
    'org:invite',
    'org:members_read',
    'org:members_manage',
    'audit:export',
    'findings:comment',
    'findings:assign',
    'agency:read',
    'agency:branding_manage',
    'agency:clients_manage',
  ],
  ORG_MEMBER: [
    'scans:create',
    'scans:read',
    'scans:cancel',
    'targets:read',
    'findings:read',
    'findings:update',
    'schedules:read',
    'monitoring:read',
    'apikeys:read',
    'ci:execute',
    'org:members_read',
    'findings:comment',
    'findings:assign',
    'agency:read',
  ],
  ORG_VIEWER: [
    'scans:read',
    'targets:read',
    'findings:read',
    'schedules:read',
    'monitoring:read',
    'org:members_read',
    'audit:read',
    'agency:read',
  ],
  ORG_AUDITOR: [
    'scans:read',
    'targets:read',
    'findings:read',
    'schedules:read',
    'monitoring:read',
    'org:members_read',
    'audit:read',
    'audit:export',
    'agency:read',
  ],
};

/**
 * Check whether an organization role possesses a specific permission.
 */
export function orgRoleHasPermission(orgRole: OrganizationRole, permission: Permission): boolean {
  const permissions = ORG_ROLE_PERMISSIONS[orgRole] || [];
  return permissions.includes(permission);
}
