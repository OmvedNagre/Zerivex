import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { isOAuthProvider, oauthOrigin, oauthRequestUrl } from '@/core/auth/oauth-config';
import { consumeOAuth, oauthCookieName } from '@/core/auth/oauth-flow';
import { exchangeGoogleCode, exchangeGitHubCode, authenticateWithOAuthProfile } from '@/core/auth/oauth-service';
import { classifyAuthFailure, authFailureDetails } from '@/core/auth/oauth-errors';
import { SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } from '@/core/auth/session-service';
import { getEnvConfig } from '@/core/config/env-validator';
import { getClientIp } from '@/core/security/rate-limiter';
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
        return NextResponse.json({ error: 'Sign-in host is not configured' }, { status: 400 });
    }
    const secure = getEnvConfig().NODE_ENV === 'production';
    function finish(response: NextResponse) {
        response.cookies.set(oauthCookieName(provider as 'google' | 'github'), '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
        for (const name of ['zerivex_oauth_state', 'zerivex_oauth_verifier', 'zerivex_oauth_return_to'])
            response.cookies.set(name, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
        response.headers.set('Cache-Control', 'no-store');
        response.headers.set('Referrer-Policy', 'no-referrer');
        return response;
    }
    function fail(code: string, reference?: string) { const url = new URL('/login', origin); url.searchParams.set('error', code); if (reference)
        url.searchParams.set('reference', reference); return finish(NextResponse.redirect(url)); }
    let stage = 'handshake';
    try {
        const attempt = await consumeOAuth(provider, req.nextUrl.searchParams.get('state'), req.cookies.get(oauthCookieName(provider))?.value, requestUrl);
        if (!attempt)
            return fail('invalid_state');
        if (req.nextUrl.searchParams.has('error'))
            return fail('oauth_denied');
        const code = req.nextUrl.searchParams.get('code');
        if (!code)
            return fail('missing_code_or_state');
        stage = 'provider';
        const profile = provider === 'google' ? await exchangeGoogleCode(code, attempt.codeVerifier, attempt.redirectUri) : await exchangeGitHubCode(code, attempt.codeVerifier, attempt.redirectUri);
        stage = 'account';
        const { rawSessionToken } = await authenticateWithOAuthProfile(profile, { ipAddress: getClientIp(req.headers, process.env.TRUST_PROXY_HEADERS === 'true'), userAgent: req.headers.get('user-agent') });
        stage = 'session';
        const response = NextResponse.redirect(new URL(attempt.returnTo, origin));
        response.cookies.set(SESSION_COOKIE_NAME, rawSessionToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: Math.floor(SESSION_LIFETIME_MS / 1000) });
        return finish(response);
    }
    catch (error) {
        const reference = crypto.randomUUID();
        const failureCode = classifyAuthFailure(error, stage);
        console.error('[ZERIVEX AUTH ERROR] OAuth callback processing failed:', JSON.stringify({ reference, provider, stage, failureCode, ...authFailureDetails(error) }));
        return fail(failureCode, reference);
    }
}
