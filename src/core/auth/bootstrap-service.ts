import crypto from 'crypto';
import { query, withTransaction } from '@/core/db/database';
import { getEnvConfig } from '@/core/config/env-validator';
import { recordAuditEvent } from '@/core/audit/audit-service';

export const BOOTSTRAP_KEY = 'INITIAL_BOOTSTRAP';

/**
 * Check whether platform owner bootstrap has already been completed.
 */
export async function isBootstrapCompleted(): Promise<boolean> {
  const res = await query(
    'SELECT id FROM platform_bootstraps WHERE bootstrap_key = $1',
    [BOOTSTRAP_KEY]
  );
  return res.rows.length > 0;
}

/**
 * Perform one-time transactional owner bootstrap during OAuth onboarding.
 * If bootstrap is already complete, this is a no-op and returns role 'USER'.
 */
export async function handleOwnerBootstrap(params: {
  userId: string;
  email: string;
  isVerified: boolean;
  displayName?: string | null;
}): Promise<'OWNER' | 'USER'> {
  const config = getEnvConfig();
  const normalizedEmail = params.email.trim().toLowerCase();
  const initialOwnerEmail = config.INITIAL_OWNER_EMAIL.trim().toLowerCase();

  return withTransaction(async (client) => {
    // 0. Fetch user's current role
    const userRes = await client.query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [params.userId]
    );
    const currentRole = (userRes.rows[0]?.role as 'OWNER' | 'USER') || 'USER';

    // 1. Check whether bootstrap is locked (inside atomic transaction)
    const checkBootstrap = await client.query(
      'SELECT id FROM platform_bootstraps WHERE bootstrap_key = $1 FOR UPDATE',
      [BOOTSTRAP_KEY]
    );

    if (checkBootstrap.rows.length > 0) {
      // Bootstrap has already completed permanently. Never promote again based on email.
      return currentRole;
    }

    // 2. Check if email matches configured INITIAL_OWNER_EMAIL and is verified
    if (params.isVerified && normalizedEmail === initialOwnerEmail) {
      // Promote user to OWNER
      await client.query(
        "UPDATE users SET role = 'OWNER', updated_at = NOW() WHERE id = $1",
        [params.userId]
      );

      // Lock bootstrap permanently
      await client.query(
        'INSERT INTO platform_bootstraps (bootstrap_key, owner_user_id, completed_at) VALUES ($1, $2, NOW())',
        [BOOTSTRAP_KEY, params.userId]
      );

      // Auto-create initial default Organization for the Owner
      const orgName = params.displayName ? `${params.displayName}'s Organization` : 'Zerivex Primary';
      const slug = `org-${crypto.randomBytes(4).toString('hex')}`;

      const orgRes = await client.query<{ id: string }>(
        'INSERT INTO organizations (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id',
        [orgName, slug, params.userId]
      );
      const orgId = orgRes.rows[0]!.id;

      // Create owner membership
      await client.query(
        "INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')",
        [orgId, params.userId]
      );

      // Create default project
      await client.query(
        "INSERT INTO projects (organization_id, name, description) VALUES ($1, 'Default Project', 'Primary security assessment project')",
        [orgId]
      );

      // Record audit log using transaction client
      await recordAuditEvent(
        {
          organizationId: orgId,
          actorUserId: params.userId,
          action: 'OWNER_BOOTSTRAP',
          resourceType: 'user',
          resourceId: params.userId,
          metadata: { email: normalizedEmail, bootstrapKey: BOOTSTRAP_KEY },
        },
        client
      );

      console.log(`[ZERIVEX BOOTSTRAP] Platform OWNER successfully bootstrapped for: ${normalizedEmail}`);
      return 'OWNER';
    }

    return currentRole;
  });
}

/**
 * Guard preventing deletion or demotion of the sole remaining platform OWNER.
 */
export async function verifySoleOwnerProtection(targetUserId: string): Promise<void> {
  const targetUserRes = await query<{ role: string }>(
    'SELECT role FROM users WHERE id = $1',
    [targetUserId]
  );

  const target = targetUserRes.rows[0];
  if (!target || target.role !== 'OWNER') {
    return; // Not an owner, demotion/deletion permitted
  }

  const ownerCountRes = await query<{ count: string }>(
    "SELECT count(*)::text as count FROM users WHERE role = 'OWNER' AND status = 'ACTIVE'"
  );

  const count = parseInt(ownerCountRes.rows[0]?.count ?? '0', 10);
  if (count <= 1) {
    throw new Error(
      '[ZERIVEX CRITICAL SECURITY] Cannot demote or delete the sole Platform Owner. You must appoint another active OWNER before performing this action.'
    );
  }
}
