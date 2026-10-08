import { NextRequest, NextResponse } from 'next/server';
import {
  requireStaffPermission,
  requireStaffReauth,
} from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'GRANT_CREDITS');
    requireStaffReauth(staff);

    // Feature gate: Credit ledger does not yet exist. Prevent fake credit grants.
    const CREDIT_LEDGER_ENABLED = process.env.CREDIT_LEDGER_ENABLED === 'true';
    if (!CREDIT_LEDGER_ENABLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Coming soon',
          message: 'Platform credit grants and credit ledger are coming soon.',
        },
        { status: 501 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = body.organizationId as string;
    const amount = Number(body.amount);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!organizationId || !amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'A valid organizationId and positive credit amount are required.' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'A justification reason is required for granting platform credits.' },
        { status: 400 }
      );
    }

    // Role cap check: Admin is limited to 1,000 credits maximum per grant
    if (staff.role === 'STAFF_ADMIN' && amount > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Staff Admins are restricted to granting a maximum of 1,000 credits. Owner approval is required for larger grants.',
        },
        { status: 403 }
      );
    }

    // Check organization exists
    const orgCheck = await query<{ name: string }>(
      `SELECT name FROM organizations WHERE id = $1`,
      [organizationId]
    );

    if (orgCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Audit grant
    await recordAuditEvent({
      organizationId,
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_CREDITS_GRANTED',
      resourceType: 'credit_grant',
      resourceId: organizationId,
      reason,
      metadata: {
        amount,
        orgName: orgCheck.rows[0]?.name || '',
        grantedByRole: staff.role,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        organizationId,
        amountGranted: amount,
        reason,
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
