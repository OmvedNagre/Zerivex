import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/core/auth/session-service';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);

  if (!cookie?.value) {
    return NextResponse.json(
      { authenticated: false, user: null, organizationId: null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  const context = await validateSessionToken(cookie.value);

  if (!context) {
    // Clear stale or revoked cookie
    const response = NextResponse.json(
      { authenticated: false, user: null, organizationId: null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: context.user,
      organizationId: context.organizationId,
      organizationRole: context.organizationRole,
      expiresAt: context.expiresAt.toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
