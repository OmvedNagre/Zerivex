import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuthenticatedUser,
  verifyCsrfProtection,
} from '@/core/rbac/authorization-guard';
import { revokeAllUserSessions, SESSION_COOKIE_NAME } from '@/core/auth/session-service';

export async function POST(req: NextRequest) {
  try {
    verifyCsrfProtection(req);
    const context = await requireAuthenticatedUser(req);

    const revokedCount = await revokeAllUserSessions(context.user.id);

    const response = NextResponse.json({
      success: true,
      message: 'All active sessions revoked',
      revokedCount,
    });

    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode ?? 400;
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status }
    );
  }
}
