import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  OAuthProvider,
  exchangeGoogleCode,
  exchangeGitHubCode,
  authenticateWithOAuthProfile,
  VerifiedOAuthProfile,
} from '@/core/auth/oauth-service';
import { SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } from '@/core/auth/session-service';
import { getEnvConfig } from '@/core/config/env-validator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const config = getEnvConfig();
  const { provider: rawProvider } = await params;
  const provider = rawProvider as OAuthProvider;
  const url = req.nextUrl;
  const searchParams = url.searchParams;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const returnToCookie = req.cookies.get('zerivex_oauth_return_to')?.value;
  const safeReturnTo = returnToCookie && returnToCookie.startsWith('/') && !returnToCookie.startsWith('//')
    ? returnToCookie
    : '/dashboard';

  if (errorParam) {
    console.warn(`[ZERIVEX AUTH] OAuth provider returned error: ${errorParam}`);
    return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/login?error=oauth_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/login?error=missing_code_or_state`);
  }

  // 1. CSRF State validation
  const storedState = req.cookies.get('zerivex_oauth_state')?.value;
  if (!storedState || storedState.length !== state.length) {
    return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`);
  }

  const stateMatches = crypto.timingSafeEqual(Buffer.from(storedState), Buffer.from(state));
  if (!stateMatches) {
    return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`);
  }

  try {
    let profile: VerifiedOAuthProfile;

    if (provider === 'google') {
      const codeVerifier = req.cookies.get('zerivex_oauth_verifier')?.value;
      profile = await exchangeGoogleCode(code, codeVerifier);
    } else if (provider === 'github') {
      profile = await exchangeGitHubCode(code);
    } else if (provider === 'mock' && config.NODE_ENV !== 'production') {
      // Hermetic mock provider for offline testing and local sandbox
      const mockEmail = searchParams.get('mock_email') || 'mock-user@zerivex.local';
      profile = {
        provider: 'mock',
        providerAccountId: `mock-sub-${crypto.randomBytes(4).toString('hex')}`,
        email: mockEmail,
        isEmailVerified: true,
        displayName: 'Mock Test User',
        avatarUrl: null,
      };
    } else {
      return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/login?error=unsupported_provider`);
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    // 2. Authenticate or Register User, execute Owner Bootstrap, and create session
    const { rawSessionToken } = await authenticateWithOAuthProfile(profile, {
      ipAddress,
      userAgent,
    });

    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}${safeReturnTo}`);

    // Set persistent session cookie
    response.cookies.set(SESSION_COOKIE_NAME, rawSessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_LIFETIME_MS / 1000),
    });

    // Clean up temporary OAuth state cookies
    response.cookies.delete('zerivex_oauth_state');
    response.cookies.delete('zerivex_oauth_verifier');
    response.cookies.delete('zerivex_oauth_return_to');

    return response;
  } catch (error) {
    console.error('[ZERIVEX AUTH ERROR] OAuth callback processing failed:', (error as Error).message);
    return NextResponse.redirect(`${config.NEXT_PUBLIC_APP_URL}/login?error=auth_failed`);
  }
}
