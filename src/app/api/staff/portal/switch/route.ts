import { NextRequest, NextResponse } from 'next/server';
import {
  requireStaffAuth,
  ensureStaffInternalOrgMembership,
} from '@/core/staff/staff-session-service';
import {
  SESSION_COOKIE_NAME,
  generateSessionToken,
  hashSessionToken,
} from '@/core/auth/session-service';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffAuth(req);
    const body = await req.json().catch(() => ({}));
    const destination = body.destination as 'CUSTOMER_PORTAL' | 'STAFF_CONSOLE';

    if (destination !== 'CUSTOMER_PORTAL' && destination !== 'STAFF_CONSOLE') {
      return NextResponse.json(
        { success: false, error: 'Destination must be CUSTOMER_PORTAL or STAFF_CONSOLE' },
        { status: 400 }
      );
    }

    const res = NextResponse.json({
      success: true,
      data: { destination },
    });

    if (destination === 'CUSTOMER_PORTAL') {
      // 1. Ensure membership in Zerivex Internal org
      await ensureStaffInternalOrgMembership(staff.userId, staff.role);

      // 2. Issue scoped customer session with via_staff_portal = true and 4h TTL
      const rawToken = generateSessionToken();
      const tokenHash = hashSessionToken(rawToken);
      const shortTtlMs = 4 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + shortTtlMs);

      await query(
        `
        INSERT INTO sessions (
          user_id,
          session_token_hash,
          ip_address,
          user_agent,
          device_name,
          expires_at,
          via_staff_portal
        )
        VALUES ($1, $2, $3, $4, $5, $6, true)
        `,
        [
          staff.userId,
          tokenHash,
          req.headers.get('x-forwarded-for')?.split(',')[0] || null,
          req.headers.get('user-agent') || null,
          'Staff Portal Switcher',
          expiresAt,
        ]
      );

      res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });
    }

    // 3. Record audit event
    await recordAuditEvent({
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_PORTAL_SWITCHED',
      resourceType: 'staff_navigation',
      resourceId: staff.userId,
      metadata: { destination, role: staff.role },
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.statusCode || 401 }
    );
  }
}
