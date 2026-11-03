import crypto from 'node:crypto';
import { query } from '@/core/db/database';
import { getEnvConfig } from '@/core/config/env-validator';
import { generateOAuthState, generatePkcePair, getOAuthAuthorizationUrl, type OAuthProvider } from './oauth-service';
import { oauthCallback, safeOAuthReturnTo } from './oauth-config';
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const encryptionKey = () => crypto.createHash('sha256').update(`zerivex-oauth-pkce:${getEnvConfig().SESSION_SECRET}`).digest();
function seal(value: string) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv); const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url'); }
function open(value: string) { const b = Buffer.from(value, 'base64url'); const cipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), b.subarray(0, 12)); cipher.setAuthTag(b.subarray(12, 28)); return Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString('utf8'); }
export const OAUTH_ATTEMPT_TTL = 600;
export function oauthCookieName(provider: OAuthProvider, purpose: 'customer' | 'staff' = 'customer') { return `${getEnvConfig().NODE_ENV === 'production' ? '__Host-' : ''}zerivex_oauth_${purpose === 'staff' ? 'staff_' : ''}${provider}`; }
export async function beginOAuth(provider: OAuthProvider, requestUrl: string, returnTo: unknown, purpose: 'customer' | 'staff' = 'customer') {
    const redirectUri = oauthCallback(provider, requestUrl, purpose);
    const state = generateOAuthState();
    const browserToken = crypto.randomBytes(32).toString('hex');
    const pkce = generatePkcePair();
    const authorizationUrl = getOAuthAuthorizationUrl(provider, state, pkce.codeChallenge, redirectUri);
    await query('DELETE FROM oauth_login_attempts WHERE expires_at<=NOW()');
    await query('INSERT INTO oauth_login_attempts (state_hash,provider,browser_token_hash,encrypted_verifier,redirect_uri,return_to,purpose,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()+INTERVAL \'10 minutes\')', [hash(state), provider, hash(browserToken), seal(pkce.codeVerifier), redirectUri, seal(safeOAuthReturnTo(returnTo)), purpose]);
    return { authorizationUrl, browserToken };
}
export async function consumeOAuth(provider: OAuthProvider, state: unknown, browserToken: unknown, requestUrl: string, purpose: 'customer' | 'staff' = 'customer') {
    if (typeof state !== 'string' || !/^[0-9a-f]{48}$/.test(state) || typeof browserToken !== 'string' || !/^[0-9a-f]{64}$/.test(browserToken))
        return null;
    const redirectUri = oauthCallback(provider, requestUrl, purpose);
    const row = (await query<{
        encrypted_verifier: string;
        redirect_uri: string;
        return_to: string;
    }>(`DELETE FROM oauth_login_attempts WHERE state_hash=$1 AND provider=$2 AND browser_token_hash=$3 AND redirect_uri=$4 AND purpose=$5 AND expires_at>NOW() RETURNING encrypted_verifier,redirect_uri,return_to`, [hash(state), provider, hash(browserToken), redirectUri, purpose])).rows[0];
    if (!row)
        return null;
    return { codeVerifier: open(row.encrypted_verifier), redirectUri: row.redirect_uri, returnTo: safeOAuthReturnTo(open(row.return_to)) };
}
