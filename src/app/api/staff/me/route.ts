import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/core/staff/staff-session-service';
import { STAFF_PERMISSIONS } from '@/core/staff/staff-permissions';

export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffAuth(req);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: staff.userId,
          email: staff.email,
          displayName: staff.displayName,
          role: staff.role,
          lastReauthAt: staff.lastReauthAt,
        },
        permissions: STAFF_PERMISSIONS[staff.role],
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
