import { NextRequest, NextResponse } from 'next/server';
import { beginOAuth, oauthCookieName, OAUTH_ATTEMPT_TTL } from '@/core/auth/oauth-flow';
import { oauthOrigin, oauthRequestUrl } from '@/core/auth/oauth-config';
import { getEnvConfig } from '@/core/config/env-validator';
export async function GET(req: NextRequest) {
    let origin: string;
    let requestUrl: string;
    try {
        requestUrl = oauthRequestUrl(req);
        origin = oauthOrigin(requestUrl);
    }
    catch {
        return NextResponse.json({ error: 'Sign-in host is not configured' }, { status: 400 });
    }
    try {
        const attempt = await beginOAuth('google', requestUrl, '/staff', 'staff');
        const response = NextResponse.redirect(attempt.authorizationUrl);
        response.cookies.set(oauthCookieName('google', 'staff'), attempt.browserToken, { httpOnly: true, secure: getEnvConfig().NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: OAUTH_ATTEMPT_TTL });
        response.headers.set('Cache-Control', 'no-store');
        response.headers.set('Referrer-Policy', 'no-referrer');
        return response;
    }
    catch {
        return NextResponse.redirect(new URL('/staff/login?error=oauth_start_failed', origin));
    }
}
