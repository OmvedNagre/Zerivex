import { NextRequest, NextResponse } from 'next/server';
import {
  OAuthProvider,
  generateOAuthState,
  generatePkcePair,
  getOAuthAuthorizationUrl,
} from '@/core/auth/oauth-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await params;
  const provider = rawProvider as OAuthProvider;

  if (!['google', 'github', 'mock'].includes(provider)) {
    return NextResponse.json({ error: 'Unsupported authentication provider' }, { status: 400 });
  }

  // Preserve safe returnTo parameter if provided (must start with / and not //)
  const returnTo = req.nextUrl.searchParams.get('returnTo');
  const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';

  const state = generateOAuthState();
  let codeChallenge: string | undefined;
  let codeVerifier: string | undefined;

  if (provider === 'google') {
    const pkce = generatePkcePair();
    codeChallenge = pkce.codeChallenge;
    codeVerifier = pkce.codeVerifier;
  }

  const authUrl = getOAuthAuthorizationUrl(provider, state, codeChallenge);
  const response = NextResponse.redirect(authUrl);

  const isProd = process.env.NODE_ENV === 'production';

  // Set state cookie (10 minute expiry)
  response.cookies.set('zerivex_oauth_state', state, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  if (codeVerifier) {
    response.cookies.set('zerivex_oauth_verifier', codeVerifier, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
  }

  response.cookies.set('zerivex_oauth_return_to', safeReturnTo, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return response;
}
