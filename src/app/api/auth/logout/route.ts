import { NextRequest, NextResponse } from 'next/server';
import { revokeSession, SESSION_COOKIE_NAME } from '@/core/auth/session-service';
import { verifyCsrfProtection } from '@/core/rbac/authorization-guard';

export async function POST(req: NextRequest) {
  try {
    verifyCsrfProtection(req);

    const cookie = req.cookies.get(SESSION_COOKIE_NAME);
    if (cookie?.value) {
      await revokeSession(cookie.value);
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
