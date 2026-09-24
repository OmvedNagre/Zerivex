/**
 * Zerivex API Key Management & Authentication Service
 * Implements cryptographically secure machine-to-machine authentication for CI/CD and CLI workflows.
 * Plaintext keys are NEVER stored in the database (only SHA-256 hashes).
 */

import crypto from 'crypto';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { PlatformRole } from '@/core/rbac/permissions';

export interface ApiKeyRecord {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string;
  userId: string;
  name: string;
  scopes: string[];
  userRole: PlatformRole;
}

export const API_KEY_PREFIX = 'zx_live_';

export const ALLOWED_API_KEY_SCOPES = [
  'scans:create',
  'scans:read',
  'targets:read',
  'reports:read',
  'ci:execute',
] as const;

export type ApiKeyScope = (typeof ALLOWED_API_KEY_SCOPES)[number];

/**
 * Hash raw API key using SHA-256 before database lookup / persistence.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a new API key with cryptographically secure random entropy.
 * Reveals the raw key exactly ONCE.
 */
export async function createApiKey(params: {
  organizationId: string;
  userId: string;
  name: string;
  scopes?: string[];
  expiresInDays?: number;
}): Promise<{ rawKey: string; apiKey: Omit<ApiKeyRecord, 'keyHash'> }> {
  const { organizationId, userId, name, scopes, expiresInDays } = params;

  if (!name || name.trim().length === 0) {
    throw new Error('API key name is required');
  }

  // Filter and default scopes
  const grantedScopes = (scopes && scopes.length > 0)
    ? scopes.filter((s) => (ALLOWED_API_KEY_SCOPES as readonly string[]).includes(s))
    : ['scans:create', 'scans:read', 'targets:read', 'ci:execute'];

  // Generate 32 bytes (256 bits) of CSPRNG entropy
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const rawKey = `${API_KEY_PREFIX}${randomEntropy}`;
  const keyPrefix = `${API_KEY_PREFIX}${randomEntropy.slice(0, 8)}`;
  const keyHash = hashApiKey(rawKey);

  const expiresAt = expiresInDays && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const res = await query<{
    id: string;
    organization_id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    status: 'ACTIVE' | 'REVOKED';
    expires_at: Date | null;
    last_used_at: Date | null;
    last_used_ip: string | null;
    created_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    INSERT INTO api_keys (
      organization_id,
      name,
      key_prefix,
      key_hash,
      scopes,
      status,
      expires_at,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7)
    RETURNING
      id,
      organization_id,
      name,
      key_prefix,
      scopes,
      status,
      expires_at,
      last_used_at,
      last_used_ip,
      created_by_user_id,
      created_at,
      updated_at
    `,
    [organizationId, name.trim(), keyPrefix, keyHash, grantedScopes, expiresAt, userId]
  );

  const row = res.rows[0]!;

  await recordAuditEvent({
    organizationId,
    actorUserId: userId,
    action: 'API_KEY_CREATED',
    resourceType: 'api_key',
    resourceId: row.id,
    metadata: {
      keyPrefix,
      name: row.name,
      scopes: row.scopes,
      expiresAt: row.expires_at,
    },
  });

  return {
    rawKey,
    apiKey: {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes: row.scopes,
      status: row.status,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      lastUsedIp: row.last_used_ip,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

/**
 * Validate raw API key from Authorization header.
 * Returns valid context or null if key does not exist, is revoked, or is expired.
 */
export async function validateApiKey(
  rawKey: string,
  clientIp?: string | null
): Promise<ApiKeyContext | null> {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  // Minimum length check (prefix 8 chars + at least 32 chars of entropy)
  if (rawKey.length < 40) {
    return null;
  }

  const keyHash = hashApiKey(rawKey);

  const res = await query<{
    apiKeyId: string;
    organizationId: string;
    name: string;
    scopes: string[];
    userId: string;
    userRole: PlatformRole;
    userStatus: string;
  }>(
    `
    SELECT
      k.id as "apiKeyId",
      k.organization_id as "organizationId",
      k.name,
      k.scopes,
      k.created_by_user_id as "userId",
      u.role as "userRole",
      u.status as "userStatus"
    FROM api_keys k
    JOIN users u ON u.id = k.created_by_user_id
    WHERE k.key_hash = $1
      AND k.status = 'ACTIVE'
      AND (k.expires_at IS NULL OR k.expires_at > NOW())
      AND u.status = 'ACTIVE'
    LIMIT 1
    `,
    [keyHash]
  );

  const row = res.rows[0];
  if (!row) {
    return null;
  }

  // Touch last_used_at and client IP asynchronously
  query(
    'UPDATE api_keys SET last_used_at = NOW(), last_used_ip = $1 WHERE id = $2',
    [clientIp ?? null, row.apiKeyId]
  ).catch(() => {});

  return {
    apiKeyId: row.apiKeyId,
    organizationId: row.organizationId,
    userId: row.userId,
    name: row.name,
    scopes: row.scopes,
    userRole: row.userRole,
  };
}

/**
 * Revoke an API key immediately.
 */
export async function revokeApiKey(params: {
  apiKeyId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<boolean> {
  const { apiKeyId, organizationId, actorUserId } = params;

  const res = await query<{ id: string; name: string; key_prefix: string }>(
    `
    UPDATE api_keys
    SET status = 'REVOKED', updated_at = NOW()
    WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE'
    RETURNING id, name, key_prefix
    `,
    [apiKeyId, organizationId]
  );

  const revoked = res.rows[0];
  if (!revoked) {
    return false;
  }

  await recordAuditEvent({
    organizationId,
    actorUserId,
    action: 'API_KEY_REVOKED',
    resourceType: 'api_key',
    resourceId: revoked.id,
    metadata: {
      name: revoked.name,
      keyPrefix: revoked.key_prefix,
    },
  });

  return true;
}

/**
 * List all API keys for an organization (with plaintext hashes omitted).
 */
export async function listApiKeysByOrg(organizationId: string): Promise<ApiKeyRecord[]> {
  const res = await query<{
    id: string;
    organization_id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    status: 'ACTIVE' | 'REVOKED';
    expires_at: Date | null;
    last_used_at: Date | null;
    last_used_ip: string | null;
    created_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT
      id,
      organization_id,
      name,
      key_prefix,
      scopes,
      status,
      expires_at,
      last_used_at,
      last_used_ip,
      created_by_user_id,
      created_at,
      updated_at
    FROM api_keys
    WHERE organization_id = $1
    ORDER BY created_at DESC
    `,
    [organizationId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    status: row.status,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    lastUsedIp: row.last_used_ip,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
