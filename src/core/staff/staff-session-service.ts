import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { query } from '@/core/db/database';
import { getEnvConfig } from '@/core/config/env-validator';
import { recordAuditEvent } from '@/core/audit/audit-service';
import {
  StaffRole,
  StaffPermission,
  StaffSessionUser,
  can,
} from './staff-permissions';

export const STAFF_SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Host-zx_staff_session'
    : 'zx_staff_session';

export function hashStaffToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateStaffToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates whether an email or domain is on the staff allowlist.
 */
export function isEmailAllowedForStaff(email: string, hd?: string | null): boolean {
  const config = getEnvConfig();
  const lowerEmail = email.toLowerCase().trim();

  // 1. Check explicit emails list
  if (config.STAFF_ALLOWED_EMAILS) {
    const allowedEmails = config.STAFF_ALLOWED_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allowedEmails.includes(lowerEmail)) {
      return true;
    }
  }

  // 2. Check hosted domain (hd claim from Google Workspace or parsed email domain)
  const emailDomain = lowerEmail.split('@')[1];
  const claimDomain = hd?.toLowerCase().trim();

  if (config.STAFF_ALLOWED_EMAIL_DOMAINS) {
    const allowedDomains = config.STAFF_ALLOWED_EMAIL_DOMAINS.split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (claimDomain && allowedDomains.includes(claimDomain)) {
      return true;
    }
    if (emailDomain && allowedDomains.includes(emailDomain)) {
      return true;
    }
  }

  return false;
}

/**
 * Creates an independent staff session.
 */
export async function createStaffSession(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ rawToken: string; expiresAt: Date; role: StaffRole }> {
  // Verify active staff role
  const roleRes = await query<{ role: StaffRole }>(
    `SELECT role FROM platform_roles WHERE user_id = $1 AND revoked_at IS NULL`,
    [params.userId]
  );

  const staffRole = roleRes.rows[0]?.role;
  if (!staffRole) {
    throw new Error('User does not have an active platform staff role');
  }

  const config = getEnvConfig();
  const ttlMinutes = config.STAFF_SESSION_TTL_MINUTES || 480;
  const rawToken = generateStaffToken();
  const tokenHash = hashStaffToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await query(
    `
    INSERT INTO staff_sessions (
      user_id,
      token_hash,
      ip_address,
      user_agent,
      expires_at,
      last_seen_at,
      last_reauth_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    `,
    [
      params.userId,
      tokenHash,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      expiresAt,
    ]
  );

  await recordAuditEvent({
    actorUserId: params.userId,
    actorType: 'STAFF',
    action: 'STAFF_LOGIN',
    resourceType: 'staff_session',
    resourceId: params.userId,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    metadata: { role: staffRole },
  });

  return { rawToken, expiresAt, role: staffRole };
}

/**
 * Validates a raw staff session token, enforcing idle and absolute timeouts.
 */
export async function validateStaffSession(
  rawToken: string
): Promise<StaffSessionUser | null> {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = hashStaffToken(rawToken);
  const config = getEnvConfig();
  const idleMinutes = config.STAFF_IDLE_TTL_MINUTES || 30;

  const res = await query<{
    userId: string;
    email: string;
    displayName: string | null;
    role: StaffRole;
    expiresAt: Date;
    lastSeenAt: Date;
    lastReauthAt: Date;
    tokenHash: string;
  }>(
    `
    SELECT
      ss.user_id as "userId",
      u.email,
      u.display_name as "displayName",
      pr.role,
      ss.expires_at as "expiresAt",
      ss.last_seen_at as "lastSeenAt",
      ss.last_reauth_at as "lastReauthAt",
      ss.token_hash as "tokenHash"
    FROM staff_sessions ss
    JOIN users u ON ss.user_id = u.id
    JOIN platform_roles pr ON ss.user_id = pr.user_id AND pr.revoked_at IS NULL
    WHERE ss.token_hash = $1
      AND ss.expires_at > NOW()
    `,
    [tokenHash]
  );

  const session = res.rows[0];
  if (!session) {
    return null;
  }

  // Check Idle Timeout
  const idleMs = idleMinutes * 60 * 1000;
  const timeSinceLastSeen = Date.now() - new Date(session.lastSeenAt).getTime();
  if (timeSinceLastSeen > idleMs) {
    // Session is idle-expired; revoke it
    await revokeStaffSession(tokenHash);
    return null;
  }

  // Update last seen timestamp
  await query(
    `UPDATE staff_sessions SET last_seen_at = NOW() WHERE token_hash = $1`,
    [tokenHash]
  );

  return {
    userId: session.userId,
    role: session.role,
    email: session.email,
    displayName: session.displayName,
    lastReauthAt: new Date(session.lastReauthAt),
    tokenHash: session.tokenHash,
  };
}

/**
 * Enforces staff authentication on an incoming HTTP request.
 */
export async function requireStaffAuth(req: NextRequest): Promise<StaffSessionUser> {
  const token = req.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const err = new Error('Authentication required');
    (err as any).statusCode = 401;
    throw err;
  }

  const staff = await validateStaffSession(token);
  if (!staff) {
    const err = new Error('Invalid or expired staff session');
    (err as any).statusCode = 401;
    throw err;
  }

  // Defense-in-depth: CSRF Origin verification on mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    const customHeader = req.headers.get('x-zerivex-staff');

    if (!customHeader || customHeader !== 'true') {
      const err = new Error('Missing custom CSRF header');
      (err as any).statusCode = 403;
      throw err;
    }

    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          const err = new Error('Origin mismatch on state-changing request');
          (err as any).statusCode = 403;
          throw err;
        }
      } catch {
        const err = new Error('Malformed Origin header');
        (err as any).statusCode = 403;
        throw err;
      }
    }
  }

  return staff;
}

/**
 * Enforces a specific staff permission.
 */
export async function requireStaffPermission(
  req: NextRequest,
  permission: StaffPermission
): Promise<StaffSessionUser> {
  const staff = await requireStaffAuth(req);

  if (!can(staff, permission)) {
    const err = new Error(`Forbidden: Staff role ${staff.role} lacks permission ${permission}`);
    (err as any).statusCode = 403;
    throw err;
  }

  return staff;
}

/**
 * Requires recent re-authentication within STAFF_REAUTH_WINDOW_MINUTES.
 */
export function requireStaffReauth(staff: StaffSessionUser): void {
  const config = getEnvConfig();
  const reauthWindowMinutes = config.STAFF_REAUTH_WINDOW_MINUTES || 10;
  const maxAgeMs = reauthWindowMinutes * 60 * 1000;

  const age = Date.now() - staff.lastReauthAt.getTime();
  if (age > maxAgeMs) {
    const err = new Error('Re-authentication required for this sensitive action');
    (err as any).statusCode = 401;
    (err as any).reauthRequired = true;
    throw err;
  }
}

/**
 * Updates re-authentication timestamp on current session.
 */
export async function refreshStaffReauth(tokenHash: string): Promise<void> {
  await query(
    `UPDATE staff_sessions SET last_reauth_at = NOW(), last_seen_at = NOW() WHERE token_hash = $1`,
    [tokenHash]
  );
}

/**
 * Revokes a staff session.
 */
export async function revokeStaffSession(tokenHash: string): Promise<void> {
  await query(`DELETE FROM staff_sessions WHERE token_hash = $1`, [tokenHash]);
}

/**
 * Gets or ensures the internal organization exists and returns its ID.
 */
export async function getZerivexInternalOrgId(): Promise<string> {
  const res = await query<{ id: string }>(
    `SELECT id FROM organizations WHERE is_internal = true LIMIT 1`
  );

  if (res.rows[0]) {
    return res.rows[0].id;
  }

  const insert = await query<{ id: string }>(
    `
    INSERT INTO organizations (name, slug, is_internal)
    VALUES ('Zerivex Internal', 'zerivex-internal', true)
    ON CONFLICT (slug) DO UPDATE SET is_internal = true
    RETURNING id
    `
  );

  return insert.rows[0]!.id;
}

/**
 * Ensures a staff user is a member of the internal organization.
 * Hard rule: NON-STAFF users CAN NEVER be members of is_internal organizations.
 */
export async function ensureStaffInternalOrgMembership(
  userId: string,
  role: StaffRole
): Promise<string> {
  // 1. Verify user actually has an active platform role
  const checkRole = await query(
    `SELECT id FROM platform_roles WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  if (checkRole.rows.length === 0) {
    throw new Error('Cannot add non-staff user to internal organization');
  }

  const orgId = await getZerivexInternalOrgId();

  // Map staff role to internal workspace role
  const orgRole = role === 'STAFF_OWNER' ? 'ORG_OWNER' : role === 'STAFF_ADMIN' ? 'ORG_ADMIN' : 'ORG_MEMBER';

  await query(
    `
    INSERT INTO memberships (organization_id, user_id, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `,
    [orgId, userId, orgRole]
  );

  return orgId;
}
