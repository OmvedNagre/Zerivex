import { NextRequest, NextResponse } from 'next/server';
import {
  requireStaffAuth,
  revokeStaffSession,
  STAFF_SESSION_COOKIE_NAME,
} from '@/core/staff/staff-session-service';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffAuth(req);

    await revokeStaffSession(staff.tokenHash);

    await recordAuditEvent({
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_LOGOUT',
      resourceType: 'staff_session',
      resourceId: staff.userId,
    });

    const res = NextResponse.json({ success: true, message: 'Logged out of staff session' });
    res.cookies.set(STAFF_SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.statusCode || 401 }
    );
  }
}
