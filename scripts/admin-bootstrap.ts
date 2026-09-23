import readline from 'readline';
import { withTransaction, closeDbPool } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { BOOTSTRAP_KEY } from '@/core/auth/bootstrap-service';

async function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function emergencyBootstrap() {
  const targetEmail = process.argv[2]?.trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    console.error('Usage: npm run admin:bootstrap <owner-email>');
    process.exit(1);
  }

  console.log(`[ZERIVEX EMERGENCY BOOTSTRAP] Initiating administrative promotion for: ${targetEmail}`);

  const confirmed = await promptConfirmation(
    `WARNING: This command grants full OWNER privileges to ${targetEmail}.\nType 'yes' to proceed: `
  );

  if (!confirmed) {
    console.log('[ZERIVEX BOOTSTRAP] Operation aborted by operator.');
    await closeDbPool();
    process.exit(0);
  }

  await withTransaction(async (client) => {
    // 1. Find or create user
    let userRes = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [targetEmail]
    );

    let userId: string;

    if (userRes.rows.length === 0) {
      console.log(`[ZERIVEX BOOTSTRAP] Creating new user record for ${targetEmail}...`);
      const createRes = await client.query<{ id: string }>(
        "INSERT INTO users (email, display_name, role, status, email_verified_at) VALUES ($1, 'Platform Owner', 'OWNER', 'ACTIVE', NOW()) RETURNING id",
        [targetEmail]
      );
      userId = createRes.rows[0]!.id;
    } else {
      userId = userRes.rows[0]!.id;
      console.log(`[ZERIVEX BOOTSTRAP] Promoting existing user ${userId} to OWNER...`);
      await client.query("UPDATE users SET role = 'OWNER', updated_at = NOW() WHERE id = $1", [userId]);
    }

    // 2. Mark bootstrap complete
    await client.query(
      `
      INSERT INTO platform_bootstraps (bootstrap_key, owner_user_id, completed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (bootstrap_key) DO UPDATE
      SET owner_user_id = $2, completed_at = NOW()
      `,
      [BOOTSTRAP_KEY, userId]
    );

    // 3. Ensure an organization exists
    const orgCheck = await client.query<{ id: string }>(
      'SELECT organization_id FROM memberships WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    let orgId: string;
    if (orgCheck.rows.length === 0) {
      const orgRes = await client.query<{ id: string }>(
        "INSERT INTO organizations (name, slug, created_by_user_id) VALUES ('Platform Admin Org', 'admin-org', $1) RETURNING id",
        [userId]
      );
      orgId = orgRes.rows[0]!.id;

      await client.query(
        "INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')",
        [orgId, userId]
      );
    } else {
      orgId = orgCheck.rows[0]!.id;
    }

    // 4. Audit the emergency bootstrap
    await recordAuditEvent({
      organizationId: orgId,
      actorUserId: userId,
      action: 'OWNER_BOOTSTRAP',
      resourceType: 'user',
      resourceId: userId,
      reason: 'Emergency server CLI bootstrap',
      metadata: { targetEmail, trigger: 'npm_run_admin_bootstrap' },
    });

    console.log(`[ZERIVEX BOOTSTRAP SUCCESS] ${targetEmail} is now verified as Platform OWNER.`);
  });

  await closeDbPool();
}

emergencyBootstrap().catch(async (err) => {
  console.error('[ZERIVEX BOOTSTRAP FATAL]', err);
  await closeDbPool();
  process.exit(1);
});
