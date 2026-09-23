import crypto from 'crypto';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { PlatformRole } from '@/core/rbac/permissions';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: PlatformRole;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface SessionContext {
  sessionId: string;
  user: AuthenticatedUser;
  organizationId: string | null;
  organizationRole: string | null;
  expiresAt: Date;
}

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Host-zerivex_session'
    : 'zerivex_session';

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Hash raw session token using SHA-256 before database storage.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure 256-bit opaque session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new server-side session and return the raw token.
 */
export async function createSession(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}): Promise<{ rawToken: string; sessionId: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  const res = await query<{ id: string }>(
    `
    INSERT INTO sessions (
      user_id,
      session_token_hash,
      ip_address,
      user_agent,
      device_name,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    [
      params.userId,
      tokenHash,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      params.deviceName ?? null,
      expiresAt,
    ]
  );

  const sessionId = res.rows[0]!.id;

  await recordAuditEvent({
    actorUserId: params.userId,
    action: 'AUTH_LOGIN',
    resourceType: 'session',
    resourceId: sessionId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { deviceName: params.deviceName },
  });

  return { rawToken, sessionId, expiresAt };
}

/**
 * Validate raw session token from HTTP-only cookie.
 * Returns safe session context or null if expired, revoked, or invalid.
 */
export async function validateSessionToken(rawToken: string): Promise<SessionContext | null> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);

  const res = await query<{
    sessionId: string;
    expiresAt: Date;
    userId: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: PlatformRole;
    status: 'ACTIVE' | 'SUSPENDED';
    organizationId: string | null;
    organizationRole: string | null;
  }>(
    `
    SELECT
      s.id as "sessionId",
      s.expires_at as "expiresAt",
      u.id as "userId",
      u.email,
      u.display_name as "displayName",
      u.avatar_url as "avatarUrl",
      u.role,
      u.status,
      m.organization_id as "organizationId",
      m.role as "organizationRole"
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN memberships m ON m.user_id = u.id
    WHERE s.session_token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND u.status = 'ACTIVE'
    ORDER BY m.created_at ASC
    LIMIT 1
    `,
    [tokenHash]
  );

  const row = res.rows[0];
  if (!row) {
    return null;
  }

  // Touch last_used_at timestamp asynchronously
  query('UPDATE sessions SET last_used_at = NOW() WHERE id = $1', [row.sessionId]).catch(() => {});

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role,
      status: row.status,
    },
    organizationId: row.organizationId,
    organizationRole: row.organizationRole,
  };
}

/**
 * Revoke a specific session (single device logout).
 */
export async function revokeSession(rawToken: string): Promise<boolean> {
  const tokenHash = hashSessionToken(rawToken);

  const res = await query<{ id: string; userId: string }>(
    `
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE session_token_hash = $1 AND revoked_at IS NULL
    RETURNING id, user_id as "userId"
    `,
    [tokenHash]
  );

  const revoked = res.rows[0];
  if (revoked) {
    await recordAuditEvent({
      actorUserId: revoked.userId,
      action: 'AUTH_LOGOUT',
      resourceType: 'session',
      resourceId: revoked.id,
    });
    return true;
  }

  return false;
}

/**
 * Revoke all active sessions for a user (logout all devices).
 */
export async function revokeAllUserSessions(
  userId: string,
  exceptRawToken?: string
): Promise<number> {
  const exceptHash = exceptRawToken ? hashSessionToken(exceptRawToken) : null;

  const res = await query<{ count: string }>(
    `
    WITH revoked AS (
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
        AND ($2::text IS NULL OR session_token_hash != $2)
      RETURNING id
    )
    SELECT count(*)::text as count FROM revoked;
    `,
    [userId, exceptHash]
  );

  const count = parseInt(res.rows[0]?.count ?? '0', 10);

  await recordAuditEvent({
    actorUserId: userId,
    action: 'AUTH_LOGOUT_ALL',
    resourceType: 'session',
    metadata: { revokedCount: count },
  });

  return count;
}
