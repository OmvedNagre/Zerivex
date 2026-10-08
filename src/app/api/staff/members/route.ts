import { NextRequest, NextResponse } from 'next/server';
import {
  requireStaffPermission,
  requireStaffReauth,
  isEmailAllowedForStaff,
} from '@/core/staff/staff-session-service';
import { query, withTransaction } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { StaffRole, VALID_STAFF_ROLES } from '@/core/staff/staff-permissions';

/**
 * List all platform staff members and their active/historical roles.
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'MANAGE_STAFF');

    const res = await query<{
      id: string;
      userId: string;
      email: string;
      displayName: string | null;
      role: StaffRole;
      createdAt: Date;
      revokedAt: Date | null;
    }>(
      `
      SELECT
        pr.id,
        pr.user_id as "userId",
        u.email,
        u.display_name as "displayName",
        pr.role,
        pr.created_at as "createdAt",
        pr.revoked_at as "revokedAt"
      FROM platform_roles pr
      JOIN users u ON pr.user_id = u.id
      ORDER BY pr.created_at ASC
      `
    );

    const activeOwnersCount = res.rows.filter(
      (r) => r.role === 'STAFF_OWNER' && !r.revokedAt
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        staffMembers: res.rows,
        activeOwnersCount,
        warningOnlyOneOwner: activeOwnersCount === 1,
        currentUserRole: staff.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.statusCode || 401 }
    );
  }
}

/**
 * Grant a new staff role to an allowed email address.
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'MANAGE_STAFF');
    requireStaffReauth(staff);

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const role = body.role as StaffRole;

    if (!email || !role || !VALID_STAFF_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Valid email and staff role are required.' },
        { status: 400 }
      );
    }

    // 1. Security Check: Email must pass the staff allowlist
    if (!isEmailAllowedForStaff(email)) {
      return NextResponse.json(
        { success: false, error: 'Email domain or address is not on the authorized staff allowlist.' },
        { status: 403 }
      );
    }

    // 2. Locate or create user record
    let userRes = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    let targetUserId: string;
    if (userRes.rows.length === 0) {
      const newUser = await query<{ id: string }>(
        `
        INSERT INTO users (email, display_name, email_verified_at, role, status)
        VALUES ($1, $2, NOW(), 'USER', 'ACTIVE')
        RETURNING id
        `,
        [email, email.split('@')[0]]
      );
      targetUserId = newUser.rows[0]!.id;
    } else {
      targetUserId = userRes.rows[0]!.id;
    }

    // 3. Upsert platform role
    await query(
      `
      INSERT INTO platform_roles (user_id, role, granted_by_user_id, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        role = EXCLUDED.role,
        granted_by_user_id = EXCLUDED.granted_by_user_id,
        revoked_at = NULL
      `,
      [targetUserId, role, staff.userId]
    );

    // 4. Audit
    await recordAuditEvent({
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_ROLE_GRANTED',
      resourceType: 'platform_role',
      resourceId: targetUserId,
      metadata: { targetEmail: email, role },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUserId,
        email,
        role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unauthorized',
        reauthRequired: Boolean(err.reauthRequired),
      },
      { status: err.statusCode || 401 }
    );
  }
}

/**
 * Modify staff member role (demote or change).
 * Strict Last-Owner Protection.
 */
export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'MANAGE_STAFF');
    requireStaffReauth(staff);

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId as string;
    const newRole = body.role as StaffRole;

    if (!targetUserId || !newRole || !VALID_STAFF_ROLES.includes(newRole)) {
      return NextResponse.json(
        { success: false, error: 'Target userId and valid new role are required.' },
        { status: 400 }
      );
    }

    // Execute inside atomic transaction with row locking
    const result = await withTransaction(async (client) => {
      const existing = await client.query<{ role: StaffRole; revokedAt: Date | null }>(
        `SELECT role, revoked_at as "revokedAt" FROM platform_roles WHERE user_id = $1 FOR UPDATE`,
        [targetUserId]
      );

      const existingRow = existing.rows[0];
      if (!existingRow || existingRow.revokedAt) {
        return { error: 'Active staff member not found.', status: 404 };
      }

      const currentRole = existingRow.role;

      // Last-Owner Protection: If demoting from STAFF_OWNER to something else
      if (currentRole === 'STAFF_OWNER' && newRole !== 'STAFF_OWNER') {
        const countRes = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM platform_roles WHERE role = 'STAFF_OWNER' AND revoked_at IS NULL FOR UPDATE`
        );
        const ownerCount = parseInt(countRes.rows[0]?.count || '0', 10);
        if (ownerCount <= 1) {
          return {
            error: 'Cannot demote the last remaining Staff Owner. At least one Owner must always exist.',
            status: 400,
          };
        }
      }

      // Update role
      await client.query(
        `
        UPDATE platform_roles
        SET role = $1, granted_by_user_id = $2, revoked_at = NULL
        WHERE user_id = $3
        `,
        [newRole, staff.userId, targetUserId]
      );

      // Invalidate active staff sessions and scoped customer sessions so new role takes effect on next request
      await client.query(`DELETE FROM staff_sessions WHERE user_id = $1`, [targetUserId]);
      await client.query(`DELETE FROM sessions WHERE user_id = $1 AND via_staff_portal = true`, [targetUserId]);

      return {
        success: true,
        data: { userId: targetUserId, role: newRole, previousRole: currentRole },
      };
    });

    if ('error' in result && result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    // Audit
    await recordAuditEvent({
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_ROLE_GRANTED',
      resourceType: 'platform_role',
      resourceId: targetUserId,
      metadata: { previousRole: result.data!.previousRole, newRole },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUserId,
        role: newRole,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unauthorized',
        reauthRequired: Boolean(err.reauthRequired),
      },
      { status: err.statusCode || 401 }
    );
  }
}

/**
 * Revoke a staff member's platform role.
 * Strict Last-Owner Protection with atomic transaction locking.
 */
export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'MANAGE_STAFF');
    requireStaffReauth(staff);

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Target userId query parameter is required.' },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (client) => {
      const existing = await client.query<{ role: StaffRole; revokedAt: Date | null }>(
        `SELECT role, revoked_at as "revokedAt" FROM platform_roles WHERE user_id = $1 FOR UPDATE`,
        [targetUserId]
      );

      const existingRow = existing.rows[0];
      if (!existingRow || existingRow.revokedAt) {
        return { error: 'Active staff member not found.', status: 404 };
      }

      // Last-Owner Protection: If revoking a STAFF_OWNER
      if (existingRow.role === 'STAFF_OWNER') {
        const countRes = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM platform_roles WHERE role = 'STAFF_OWNER' AND revoked_at IS NULL FOR UPDATE`
        );
        const ownerCount = parseInt(countRes.rows[0]?.count || '0', 10);
        if (ownerCount <= 1) {
          return {
            error: 'Cannot revoke the last remaining Staff Owner. At least one Owner must always exist.',
            status: 400,
          };
        }
      }

      // Revoke platform role
      await client.query(
        `UPDATE platform_roles SET revoked_at = NOW() WHERE user_id = $1`,
        [targetUserId]
      );

      // Revoke any active staff sessions and scoped customer sessions
      await client.query(`DELETE FROM staff_sessions WHERE user_id = $1`, [targetUserId]);
      await client.query(`DELETE FROM sessions WHERE user_id = $1 AND via_staff_portal = true`, [targetUserId]);

      return {
        success: true,
        data: { userId: targetUserId, revokedRole: existingRow.role },
      };
    });

    if ('error' in result && result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    // Audit
    await recordAuditEvent({
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_ROLE_REVOKED',
      resourceType: 'platform_role',
      resourceId: targetUserId,
      metadata: { revokedRole: result.data!.revokedRole },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUserId,
        revoked: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unauthorized',
        reauthRequired: Boolean(err.reauthRequired),
      },
      { status: err.statusCode || 401 }
    );
  }
}
