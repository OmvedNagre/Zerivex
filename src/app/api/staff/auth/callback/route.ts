import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/core/db/database';
import { getEnvConfig } from '@/core/config/env-validator';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { isEmailAllowedForStaff, createStaffSession, STAFF_SESSION_COOKIE_NAME } from '@/core/staff/staff-session-service';
import { getClientIp } from '@/core/security/rate-limiter';
import { oauthOrigin, oauthRequestUrl } from '@/core/auth/oauth-config';
import { consumeOAuth, oauthCookieName } from '@/core/auth/oauth-flow';
import { exchangeGoogleCode } from '@/core/auth/oauth-service';
import { classifyAuthFailure, authFailureDetails } from '@/core/auth/oauth-errors';
export async function POST() { return NextResponse.json({ error: 'Use the browser-bound Google staff sign-in flow' }, { status: 405, headers: { Allow: 'GET' } }); }
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
    const secure = getEnvConfig().NODE_ENV === 'production';
    const ip = getClientIp(req.headers, process.env.TRUST_PROXY_HEADERS === 'true');
    const cookie = oauthCookieName('google', 'staff');
    function finish(response: NextResponse) { response.cookies.set(cookie, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 }); response.headers.set('Cache-Control', 'no-store'); response.headers.set('Referrer-Policy', 'no-referrer'); return response; }
    function fail(code: string, reference?: string) { const url = new URL('/staff/login', origin); url.searchParams.set('error', code); if (reference)
        url.searchParams.set('reference', reference); return finish(NextResponse.redirect(url)); }
    let stage = 'handshake';
    try {
        const attempt = await consumeOAuth('google', req.nextUrl.searchParams.get('state'), req.cookies.get(cookie)?.value, requestUrl, 'staff');
        if (!attempt)
            return fail('invalid_state');
        if (req.nextUrl.searchParams.has('error'))
            return fail('oauth_denied');
        const code = req.nextUrl.searchParams.get('code');
        if (!code)
            return fail('missing_code_or_state');
        stage = 'provider';
        const profile = await exchangeGoogleCode(code, attempt.codeVerifier, attempt.redirectUri);
        stage = 'account';
        const user = (await query<{
            id: string;
        }>(`SELECT u.id FROM users u JOIN platform_roles p ON p.user_id=u.id AND p.revoked_at IS NULL WHERE LOWER(u.email)=$1 AND u.status='ACTIVE'`, [profile.email.toLowerCase()])).rows[0];
        if (!profile.isEmailVerified || !isEmailAllowedForStaff(profile.email, profile.hostedDomain) || !user) {
            await recordAuditEvent({ actorType: 'SYSTEM', action: 'STAFF_FAILED_LOGIN', resourceType: 'staff_auth', ipAddress: ip, metadata: { failure: 'staff_access_denied' } });
            return fail('unauthorized');
        }
        const session = await createStaffSession({ userId: user.id, ipAddress: ip, userAgent: req.headers.get('user-agent') });
        stage = 'session';
        const response = NextResponse.redirect(new URL('/staff', origin));
        response.cookies.set(STAFF_SESSION_COOKIE_NAME, session.rawToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', expires: session.expiresAt });
        return finish(response);
    }
    catch (error) {
        const reference = crypto.randomUUID();
        const failure = classifyAuthFailure(error, stage);
        console.error('[ZERIVEX STAFF AUTH ERROR]', JSON.stringify({ reference, stage, failure, ...authFailureDetails(error) }));
        return fail(failure, reference);
    }
}
