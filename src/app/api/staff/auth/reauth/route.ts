import { NextRequest, NextResponse } from 'next/server';
import {
  requireStaffAuth,
  refreshStaffReauth,
} from '@/core/staff/staff-session-service';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { getEnvConfig } from '@/core/config/env-validator';

/**
 * Server-side exchange/verification of Google tokens for Staff.
 */
async function verifyGoogleTokenOrCode(codeOrToken: string, redirectUri: string) {
  const config = getEnvConfig();

  const bodyParams: Record<string, string> = {
    client_id: config.GOOGLE_CLIENT_ID ?? '',
    client_secret: config.GOOGLE_CLIENT_SECRET ?? '',
    code: codeOrToken,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(bodyParams),
  });

  if (!tokenRes.ok) {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(codeOrToken)}`
    );
    if (tokenInfoRes.ok) {
      const data = await tokenInfoRes.json();
      return {
        email: data.email as string,
        email_verified: data.email_verified === 'true' || data.email_verified === true,
        hd: (data.hd as string) || null,
      };
    }
    throw new Error('Google token verification failed');
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    throw new Error('Failed to retrieve userinfo from Google');
  }

  const userinfo = await userRes.json();
  return {
    email: userinfo.email as string,
    email_verified: Boolean(userinfo.email_verified),
    hd: (userinfo.hd as string) || null,
  };
}

/**
 * Start re-auth: provides Google URL with prompt=select_account&max_age=0
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffAuth(req);
    const config = getEnvConfig();

    const redirectUri = `${config.NEXT_PUBLIC_APP_URL}/api/staff/auth/callback`;
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', config.GOOGLE_CLIENT_ID || '');
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('max_age', '0');
    googleAuthUrl.searchParams.set('login_hint', staff.email);
    googleAuthUrl.searchParams.set('state', 'reauth');

    return NextResponse.json({
      success: true,
      data: {
        reauthUrl: googleAuthUrl.toString(),
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
 * Complete re-auth: requires fresh Google sign-in code/token verification for the same user.
 * Direct calls with only cookie/header are strictly rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffAuth(req);
    const config = getEnvConfig();

    const body = await req.json().catch(() => ({}));
    const code = body.code || body.idToken;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Re-authentication requires a fresh Google sign-in verification round trip. Missing Google credential.',
        },
        { status: 400 }
      );
    }

    const redirectUri = `${config.NEXT_PUBLIC_APP_URL}/api/staff/auth/callback`;
    const googleProfile = await verifyGoogleTokenOrCode(code, redirectUri);

    if (
      !googleProfile.email_verified ||
      googleProfile.email.toLowerCase().trim() !== staff.email.toLowerCase().trim()
    ) {
      await recordAuditEvent({
        actorUserId: staff.userId,
        actorType: 'STAFF',
        action: 'STAFF_REAUTH',
        resourceType: 'staff_session',
        resourceId: staff.userId,
        metadata: { status: 'failed_account_mismatch', attemptedEmail: googleProfile.email },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Re-authentication account mismatch. You must re-authenticate with your existing staff account.',
        },
        { status: 403 }
      );
    }

    await refreshStaffReauth(staff.tokenHash);

    await recordAuditEvent({
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_REAUTH',
      resourceType: 'staff_session',
      resourceId: staff.userId,
      metadata: { status: 'success' },
    });

    return NextResponse.json({
      success: true,
      data: {
        lastReauthAt: new Date(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.statusCode || 401 }
    );
  }
}
