import { query, closeDbPool } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { getZerivexInternalOrgId } from '@/core/staff/staff-session-service';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {}
}

export async function seedStaffOwner() {
  const email = process.env.STAFF_BOOTSTRAP_OWNER_EMAIL || process.env.INITIAL_OWNER_EMAIL;
  if (!email) {
    console.error('[STAFF BOOTSTRAP ERROR] STAFF_BOOTSTRAP_OWNER_EMAIL or INITIAL_OWNER_EMAIL must be set.');
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();
  console.log(`[STAFF BOOTSTRAP] Bootstrapping STAFF_OWNER for: ${cleanEmail}`);

  // 1. Ensure user exists
  let userRes = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [cleanEmail]
  );

  let userId: string;
  if (userRes.rows.length === 0) {
    console.log(`[STAFF BOOTSTRAP] Creating user record for ${cleanEmail}...`);
    const insertUser = await query<{ id: string }>(
      `
      INSERT INTO users (email, display_name, email_verified_at, role, status)
      VALUES ($1, $2, NOW(), 'OWNER', 'ACTIVE')
      RETURNING id
      `,
      [cleanEmail, 'Zerivex Staff Owner']
    );
    userId = insertUser.rows[0]!.id;
  } else {
    userId = userRes.rows[0]!.id;
  }

  // 2. Grant STAFF_OWNER platform role (idempotent)
  await query(
    `
    INSERT INTO platform_roles (user_id, role, created_at)
    VALUES ($1, 'STAFF_OWNER', NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      role = 'STAFF_OWNER',
      revoked_at = NULL
    `,
    [userId]
  );

  // 3. Ensure internal organization membership
  const internalOrgId = await getZerivexInternalOrgId();
  await query(
    `
    INSERT INTO memberships (organization_id, user_id, role)
    VALUES ($1, $2, 'ORG_OWNER')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'ORG_OWNER'
    `,
    [internalOrgId, userId]
  );

  // 4. Audit log event
  await recordAuditEvent({
    actorUserId: userId,
    actorType: 'SYSTEM',
    action: 'STAFF_ROLE_GRANTED',
    resourceType: 'platform_role',
    resourceId: userId,
    reason: 'CLI bootstrap script execution',
    metadata: { role: 'STAFF_OWNER', email: cleanEmail },
  });

  console.log(`[STAFF BOOTSTRAP SUCCESS] Successfully bootstrapped STAFF_OWNER for ${cleanEmail} (ID: ${userId})`);
  await closeDbPool();
}

seedStaffOwner().catch(async (err) => {
  console.error('[STAFF BOOTSTRAP FATAL]', err);
  await closeDbPool();
  process.exit(1);
});
