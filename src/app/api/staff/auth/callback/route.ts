import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/core/db/database';
import { getEnvConfig } from '@/core/config/env-validator';
import { recordAuditEvent } from '@/core/audit/audit-service';
import {
  isEmailAllowedForStaff,
  createStaffSession,
  STAFF_SESSION_COOKIE_NAME,
} from '@/core/staff/staff-session-service';
import { defaultRateLimiter, getClientIp } from '@/core/security/rate-limiter';

/**
 * Server-side exchange/verification of Google tokens for Staff.
 * Strictly Google-only. No dev/mock/GitHub logins allowed under any circumstances.
 */
async function verifyGoogleTokenOrCode(codeOrToken: string, redirectUri: string) {
  const config = getEnvConfig();

  // If code is provided, exchange via Google OIDC
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
    // If it's not a code, maybe it's directly an ID token / access token
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(codeOrToken)}`);
    if (tokenInfoRes.ok) {
      const data = await tokenInfoRes.json();
      return {
        email: data.email as string,
        email_verified: data.email_verified === 'true' || data.email_verified === true,
        hd: (data.hd as string) || null,
        name: (data.name as string) || null,
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
    name: (userinfo.name as string) || null,
  };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent') || null;
  const config = getEnvConfig();

  // Rate Limiting on staff auth attempts
  const rateLimitKey = `STAFF_AUTH:${ip}`;
  const rateCheck = defaultRateLimiter.check(rateLimitKey, 'AUTH');
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too Many Requests',
        message: 'Too many authentication attempts. Please retry later.',
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = body.code || body.idToken;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "You don't have access" },
        { status: 400 }
      );
    }

    const redirectUri = `${config.NEXT_PUBLIC_APP_URL}/api/staff/auth/callback`;
    const googleProfile = await verifyGoogleTokenOrCode(code, redirectUri);

    // 1. Enforce verified email
    if (!googleProfile.email_verified) {
      await recordAuditEvent({
        actorType: 'SYSTEM',
        action: 'STAFF_FAILED_LOGIN',
        resourceType: 'staff_auth',
        ipAddress: ip,
        userAgent,
        metadata: { failure: 'unverified_email' },
      });
      return NextResponse.json(
        { success: false, error: "You don't have access" },
        { status: 403 }
      );
    }

    // 2. Enforce allowed domain or email list
    if (!isEmailAllowedForStaff(googleProfile.email, googleProfile.hd)) {
      await recordAuditEvent({
        actorType: 'SYSTEM',
        action: 'STAFF_FAILED_LOGIN',
        resourceType: 'staff_auth',
        ipAddress: ip,
        userAgent,
        metadata: { failure: 'domain_not_allowed' },
      });
      return NextResponse.json(
        { success: false, error: "You don't have access" },
        { status: 403 }
      );
    }

    // 3. Find user and active platform role
    const userRes = await query<{ id: string; role: string }>(
      `
      SELECT u.id, pr.role
      FROM users u
      JOIN platform_roles pr ON u.id = pr.user_id AND pr.revoked_at IS NULL
      WHERE u.email = $1
      `,
      [googleProfile.email.toLowerCase().trim()]
    );

    const match = userRes.rows[0];
    if (!match) {
      await recordAuditEvent({
        actorType: 'SYSTEM',
        action: 'STAFF_FAILED_LOGIN',
        resourceType: 'staff_auth',
        ipAddress: ip,
        userAgent,
        metadata: { failure: 'no_active_platform_role' },
      });
      return NextResponse.json(
        { success: false, error: "You don't have access" },
        { status: 403 }
      );
    }

    // 4. Issue staff session
    const { rawToken, expiresAt, role } = await createStaffSession({
      userId: match.id,
      ipAddress: ip,
      userAgent,
    });

    const isProd = process.env.NODE_ENV === 'production';
    const res = NextResponse.json({
      success: true,
      data: { role },
    });

    res.cookies.set(STAFF_SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return res;
  } catch (err) {
    await recordAuditEvent({
      actorType: 'SYSTEM',
      action: 'STAFF_FAILED_LOGIN',
      resourceType: 'staff_auth',
      ipAddress: ip,
      userAgent,
      metadata: { failure: 'exception_thrown' },
    });
    return NextResponse.json(
      { success: false, error: "You don't have access" },
      { status: 403 }
    );
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent') || null;
  const config = getEnvConfig();
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/staff/login?error=unauthorized`);
  }

  try {
    const redirectUri = `${config.NEXT_PUBLIC_APP_URL}/api/staff/auth/callback`;
    const googleProfile = await verifyGoogleTokenOrCode(code, redirectUri);

    if (!googleProfile.email_verified || !isEmailAllowedForStaff(googleProfile.email, googleProfile.hd)) {
      await recordAuditEvent({
        actorType: 'SYSTEM',
        action: 'STAFF_FAILED_LOGIN',
        resourceType: 'staff_auth',
        ipAddress: ip,
        userAgent,
        metadata: { failure: 'unauthorized_domain_or_unverified' },
      });
      return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/staff/login?error=unauthorized`);
    }

    const userRes = await query<{ id: string }>(
      `
      SELECT u.id
      FROM users u
      JOIN platform_roles pr ON u.id = pr.user_id AND pr.revoked_at IS NULL
      WHERE u.email = $1
      `,
      [googleProfile.email.toLowerCase().trim()]
    );

    const match = userRes.rows[0];
    if (!match) {
      await recordAuditEvent({
        actorType: 'SYSTEM',
        action: 'STAFF_FAILED_LOGIN',
        resourceType: 'staff_auth',
        ipAddress: ip,
        userAgent,
        metadata: { failure: 'no_platform_role' },
      });
      return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/staff/login?error=unauthorized`);
    }

    const { rawToken, expiresAt } = await createStaffSession({
      userId: match.id,
      ipAddress: ip,
      userAgent,
    });

    const isProd = process.env.NODE_ENV === 'production';
    const res = NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/staff`);
    res.cookies.set(STAFF_SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return res;
  } catch {
    return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/staff/login?error=unauthorized`);
  }
}
