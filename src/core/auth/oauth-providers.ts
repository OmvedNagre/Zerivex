import { z } from 'zod';
import type { OAuthProvider, VerifiedOAuthProfile } from './oauth-service';
import { oauthCallback, oauthClient, validateOAuthCallback } from './oauth-config';
import { OAuthExchangeError, OAuthProfileError } from './oauth-errors';
const googleProfile = z.object({ sub: z.string().min(1), email: z.email(), email_verified: z.literal(true), name: z.string().optional(), picture: z.url().optional(), hd: z.string().optional() });
const githubProfile = z.object({ id: z.number().int().positive(), login: z.string().min(1), name: z.string().nullable().optional(), avatar_url: z.url().optional() });
const githubEmails = z.array(z.object({ email: z.email(), verified: z.boolean(), primary: z.boolean() }));
const timeout = () => AbortSignal.timeout(15000);
async function json(response: Response): Promise<Record<string, unknown>> { const data = await response.json().catch(() => null); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
export function authorizationUrl(provider: OAuthProvider, state: string, challenge?: string, callback?: string) {
    const { clientId } = oauthClient(provider);
    const redirectUri = validateOAuthCallback(provider, callback || oauthCallback(provider));
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state, scope: provider === 'google' ? 'openid email profile' : 'read:user user:email' });
    if (challenge) {
        params.set('code_challenge', challenge);
        params.set('code_challenge_method', 'S256');
    }
    params.set('prompt', 'select_account');
    return `${provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://github.com/login/oauth/authorize'}?${params}`;
}
export async function providerProfile(provider: OAuthProvider, code: string, verifier?: string, callback?: string): Promise<VerifiedOAuthProfile> {
    if (!code || code.length > 4096)
        throw new OAuthExchangeError(provider, 400, 'invalid_grant');
    const { clientId, clientSecret } = oauthClient(provider);
    const redirectUri = validateOAuthCallback(provider, callback || oauthCallback(provider));
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
    if (verifier)
        body.set('code_verifier', verifier);
    const response = await fetch(provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://github.com/login/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body, signal: timeout(), redirect: 'error', cache: 'no-store' });
    const token = await json(response);
    if (!response.ok || token.error || typeof token.access_token !== 'string' || !token.access_token)
        throw new OAuthExchangeError(provider, response.status, token.error);
    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json', 'User-Agent': 'Zerivex-Auth' };
    const profileResponse = await fetch(provider === 'google' ? 'https://openidconnect.googleapis.com/v1/userinfo' : 'https://api.github.com/user', { headers, signal: timeout(), redirect: 'error', cache: 'no-store' });
    if (!profileResponse.ok)
        throw new OAuthProfileError('profile_unavailable');
    const data = await json(profileResponse);
    if (provider === 'google') {
        const parsed = googleProfile.safeParse(data);
        if (!parsed.success)
            throw new OAuthProfileError(data.email_verified !== true ? 'unverified_email' : 'profile_unavailable');
        return { provider, providerAccountId: parsed.data.sub, email: parsed.data.email, isEmailVerified: true, displayName: parsed.data.name, avatarUrl: parsed.data.picture, hostedDomain: parsed.data.hd };
    }
    const user = githubProfile.safeParse(data);
    if (!user.success)
        throw new OAuthProfileError('profile_unavailable');
    const emailsResponse = await fetch('https://api.github.com/user/emails', { headers, signal: timeout(), redirect: 'error', cache: 'no-store' });
    if (!emailsResponse.ok)
        throw new OAuthProfileError('profile_unavailable');
    const emails = githubEmails.safeParse(await emailsResponse.json().catch(() => null));
    if (!emails.success)
        throw new OAuthProfileError('profile_unavailable');
    const email = emails.data.find(e => e.primary && e.verified) || emails.data.find(e => e.verified);
    if (!email)
        throw new OAuthProfileError('unverified_email');
    return { provider, providerAccountId: String(user.data.id), email: email.email, isEmailVerified: true, displayName: user.data.name || user.data.login, avatarUrl: user.data.avatar_url };
}
