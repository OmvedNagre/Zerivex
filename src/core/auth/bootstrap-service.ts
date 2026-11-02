import { query } from '@/core/db/database';

export const BOOTSTRAP_KEY = 'INITIAL_BOOTSTRAP';

export async function isBootstrapCompleted(): Promise<boolean> {
  return (await query('SELECT id FROM platform_bootstraps WHERE bootstrap_key = $1', [BOOTSTRAP_KEY])).rows.length > 0;
}

/** OAuth login never promotes an account. Staff provisioning is an explicit operator action. */
export async function handleOwnerBootstrap(params: {
  userId: string; email: string; isVerified: boolean; displayName?: string | null;
}): Promise<'OWNER' | 'USER'> {
  const result = await query<{ role: 'OWNER' | 'USER' }>('SELECT role FROM users WHERE id = $1', [params.userId]);
  return result.rows[0]?.role || 'USER';
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
