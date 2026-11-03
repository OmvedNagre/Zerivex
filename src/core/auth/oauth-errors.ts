const PROVIDER_ERRORS = new Set(['invalid_client', 'invalid_grant', 'invalid_request', 'redirect_uri_mismatch', 'access_denied', 'unauthorized_client', 'incorrect_client_credentials', 'bad_verification_code']);
export class OAuthConfigurationError extends Error {
    constructor(readonly reason: 'client' | 'origin') { super('OAuth configuration is unavailable'); this.name = 'OAuthConfigurationError'; }
}
export class OAuthExchangeError extends Error {
    readonly providerCode: string;
    constructor(readonly provider: string, readonly httpStatus: number, code: unknown) {
        const providerCode = typeof code === 'string' && PROVIDER_ERRORS.has(code) ? code : 'unknown';
        super(`${provider} token exchange failed: HTTP ${httpStatus} (${providerCode})`);
        this.name = 'OAuthExchangeError';
        this.providerCode = providerCode;
    }
}
export class OAuthProfileError extends Error {
    constructor(readonly reason: 'unverified_email' | 'profile_unavailable') { super(reason); this.name = 'OAuthProfileError'; }
}
export function classifyAuthFailure(error: unknown, stage: string) {
    if (error instanceof OAuthConfigurationError)
        return error.reason === 'client' ? 'oauth_client_config' : 'oauth_redirect_config';
    if (error instanceof OAuthExchangeError) {
        if (error.httpStatus === 401 || ['invalid_client', 'unauthorized_client', 'incorrect_client_credentials'].includes(error.providerCode))
            return 'oauth_client_config';
        if (['invalid_grant', 'bad_verification_code'].includes(error.providerCode))
            return 'oauth_code_exchange';
        if (error.providerCode === 'redirect_uri_mismatch')
            return 'oauth_redirect_config';
        if (error.httpStatus >= 500)
            return 'oauth_provider_unavailable';
        return 'oauth_exchange_failed';
    }
    if (error instanceof OAuthProfileError)
        return error.reason === 'unverified_email' ? 'oauth_email_unverified' : 'oauth_profile_failed';
    if (stage === 'account')
        return 'account_setup_failed';
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
        return 'oauth_provider_unavailable';
    return 'auth_failed';
}
/** Safe diagnostics only: never include provider response bodies, codes, cookies or tokens. */
export function authFailureDetails(error: unknown) {
    if (error instanceof OAuthExchangeError)
        return { httpStatus: error.httpStatus, providerError: error.providerCode };
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    return { databaseCode: /^[0-9A-Z]{5}$/.test(code) ? code : undefined };
}
