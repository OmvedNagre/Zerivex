import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SessionContext, SESSION_COOKIE_NAME } from '@/core/auth/session-service';
import { PlatformRole, Permission, roleHasPermission } from '@/core/rbac/permissions';
import { recordAuditEvent } from '@/core/audit/audit-service';

export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Access forbidden: insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Extract and validate session context from NextRequest cookie.
 * Throws UnauthorizedError (401) if unauthenticated.
 */
export async function requireAuthenticatedUser(req: NextRequest): Promise<SessionContext> {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) {
    throw new UnauthorizedError('Missing or expired session cookie');
  }

  const context = await validateSessionToken(cookie.value);
  if (!context) {
    throw new UnauthorizedError('Invalid, expired, or revoked session');
  }

  return context;
}

/**
 * Enforce that the authenticated user possesses a specific platform permission.
 * Throws ForbiddenError (403) if unauthorized.
 */
export function requirePermission(context: SessionContext, permission: Permission): void {
  if (context.user.role === 'OWNER') {
    return; // Owner entitlement override
  }

  if (!roleHasPermission(context.user.role, permission)) {
    throw new ForbiddenError(`Role '${context.user.role}' lacks required permission: '${permission}'`);
  }
}

/**
 * Enforce that the authenticated user holds one of the permitted platform roles.
 */
export function requirePlatformRole(context: SessionContext, allowedRoles: PlatformRole[]): void {
  if (context.user.role === 'OWNER') {
    return; // Owner always authorized
  }

  if (!allowedRoles.includes(context.user.role)) {
    throw new ForbiddenError(`Action restricted to roles: [${allowedRoles.join(', ')}]`);
  }
}

/**
 * Enforce tenant resource isolation.
 * Guarantees a tenant cannot access or mutate another tenant's resources.
 * If an OWNER accesses another tenant's data, it is explicitly audit-logged.
 */
export async function requireTenantAccess(
  context: SessionContext,
  resourceOrganizationId: string,
  resourceType: string,
  resourceId?: string
): Promise<void> {
  if (context.user.role === 'OWNER') {
    // Owner is authorized to view customer resources, but the action MUST be audited
    if (context.organizationId !== resourceOrganizationId) {
      await recordAuditEvent({
        organizationId: resourceOrganizationId,
        actorUserId: context.user.id,
        action: 'ADMIN_ACCESS',
        resourceType,
        resourceId,
        reason: 'Platform Owner cross-tenant inspection',
      });
    }
    return;
  }

  if (!context.organizationId || context.organizationId !== resourceOrganizationId) {
    throw new ForbiddenError('Cross-tenant resource access is prohibited');
  }
}

/**
 * Enforce CSRF protection for cookie-authenticated state-changing requests (POST, PUT, DELETE, PATCH).
 */
export function verifyCsrfProtection(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return; // Safe methods exempt
  }

  // Verify custom requested-with header or Sec-Fetch-Site to block cross-origin browser form submissions
  const requestedWith = req.headers.get('x-requested-with');
  const secFetchSite = req.headers.get('sec-fetch-site');

  if (requestedWith === 'XMLHttpRequest' || secFetchSite === 'same-origin') {
    return;
  }

  // Also accept matching origin with host
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        return;
      }
    } catch {
      // Invalid origin URL
    }
  }

  throw new ForbiddenError('CSRF validation failed: missing valid origin or X-Requested-With header');
}

/**
 * Convenient alias for requireAuthenticatedUser.
 */
export const requireAuth = requireAuthenticatedUser;

/**
 * Handle authentication and authorization errors consistently across API route handlers.
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json(
    { error: (error as Error).message || 'Internal server error' },
    { status: 500 }
  );
}
