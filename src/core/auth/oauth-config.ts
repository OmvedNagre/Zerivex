import { OAuthConfigurationError } from './oauth-errors';
import { getEnvConfig } from '@/core/config/env-validator';
import type { OAuthProvider } from './oauth-service';
export function isOAuthProvider(value: string): value is OAuthProvider { return value === 'google' || value === 'github'; }
export function safeOAuthReturnTo(value: unknown): string {
    if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20\x7f]/.test(value))
        return '/dashboard';
    try {
        const u = new URL(value, 'https://return.invalid');
        return u.origin === 'https://return.invalid' ? `${u.pathname}${u.search}${u.hash}` : '/dashboard';
    }
    catch {
        return '/dashboard';
    }
}
/** Trust only the configured host and its exact www/apex counterpart, never arbitrary Host headers. */
export function oauthOrigin(requestUrl?: string): string {
    const config = getEnvConfig();
    const configured = new URL(config.NEXT_PUBLIC_APP_URL.trim());
    if (configured.username || configured.password || configured.search || configured.hash || !['http:', 'https:'].includes(configured.protocol) || configured.pathname !== '/')
        throw new OAuthConfigurationError('origin');
    if (config.NODE_ENV === 'production' && configured.protocol !== 'https:')
        throw new OAuthConfigurationError('origin');
    if (!requestUrl)
        return configured.origin;
    const actual = new URL(requestUrl);
    if (actual.origin === configured.origin)
        return actual.origin;
    const paired = actual.hostname === `www.${configured.hostname}` || configured.hostname === `www.${actual.hostname}`;
    if (paired && actual.protocol === 'https:' && actual.protocol === configured.protocol && actual.port === configured.port && !['localhost', '127.0.0.1'].includes(configured.hostname))
        return actual.origin;
    throw new OAuthConfigurationError('origin');
}
export function oauthClient(provider: OAuthProvider) {
    const config = getEnvConfig();
    const clientId = (provider === 'google' ? config.GOOGLE_CLIENT_ID : config.GITHUB_CLIENT_ID)?.trim();
    const clientSecret = (provider === 'google' ? config.GOOGLE_CLIENT_SECRET : config.GITHUB_CLIENT_SECRET)?.trim();
    if (!clientId || !clientSecret || /[\r\n]/.test(clientId + clientSecret))
        throw new OAuthConfigurationError('client');
    return { clientId, clientSecret };
}
export function oauthCallback(provider: OAuthProvider, requestUrl?: string, purpose: 'customer' | 'staff' = 'customer') {
    if (purpose === 'staff' && provider !== 'google')
        throw new OAuthConfigurationError('origin');
    return `${oauthOrigin(requestUrl)}${purpose === 'staff' ? '/api/staff/auth/callback' : `/api/auth/callback/${provider}`}`;
}
export function validateOAuthCallback(provider: OAuthProvider, callback: string) {
    const u = new URL(callback);
    if (callback !== oauthCallback(provider, u.origin) && !(provider === 'google' && callback === oauthCallback(provider, u.origin, 'staff')))
        throw new OAuthConfigurationError('origin');
    return callback;
}

/** Next.js can normalize req.url to an internal hostname. Validate the public Host against the configured origin. */
export function oauthRequestUrl(request: {url:string;headers:Headers}):string {
  const url=new URL(request.url);const host=request.headers.get('host');
  if(!host){oauthOrigin(url.href);return url.href;}
  if(!/^[a-z0-9.[\]:-]+$/i.test(host))throw new OAuthConfigurationError('origin');
  const protocol=new URL(getEnvConfig().NEXT_PUBLIC_APP_URL).protocol;
  const publicUrl=new URL(`${protocol}//${host}`);
  oauthOrigin(publicUrl.href);
  publicUrl.pathname=url.pathname;publicUrl.search=url.search;
  return publicUrl.href;
}
