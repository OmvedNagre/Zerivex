import crypto from 'node:crypto';
import { classifyAuthFailure, authFailureDetails } from '@/core/auth/oauth-errors';
import { NextRequest, NextResponse } from 'next/server';
import { isOAuthProvider, oauthOrigin, oauthRequestUrl } from '@/core/auth/oauth-config';
import { beginOAuth, oauthCookieName, OAUTH_ATTEMPT_TTL } from '@/core/auth/oauth-flow';
import { getEnvConfig } from '@/core/config/env-validator';
export async function GET(req: NextRequest, { params }: {
    params: Promise<{
        provider: string;
    }>;
}) {
    const { provider } = await params;
    if (!isOAuthProvider(provider))
        return NextResponse.json({ error: 'Unsupported authentication provider' }, { status: 400 });
    let origin: string;
    let requestUrl: string;
    try {
        requestUrl = oauthRequestUrl(req);
        origin = oauthOrigin(requestUrl);
    }
    catch {
        return NextResponse.json({ error: "Sign-in host is not configured" }, { status: 400 });
    }
    try {
        const attempt = await beginOAuth(provider, requestUrl, req.nextUrl.searchParams.get('returnTo'));
        const response = NextResponse.redirect(attempt.authorizationUrl);
        response.headers.set('Cache-Control', 'no-store');
        response.headers.set('Referrer-Policy', 'no-referrer');
        response.cookies.set(oauthCookieName(provider), attempt.browserToken, { httpOnly: true, secure: getEnvConfig().NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: OAUTH_ATTEMPT_TTL });
        return response;
    }
    catch (error) {
        const reference = crypto.randomUUID();
        const classified = classifyAuthFailure(error, 'handshake');
        const failureCode = classified === 'auth_failed' ? 'oauth_start_failed' : classified;
        console.error('[ZERIVEX AUTH ERROR] Unable to start OAuth login', JSON.stringify({ provider, reference, failureCode, ...authFailureDetails(error) }));
        const url = new URL('/login', origin);
        url.searchParams.set('error', failureCode);
        url.searchParams.set('reference', reference);
        const response = NextResponse.redirect(url);
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }
}
