import { loadLocalEnvironment } from './lib/environment';
loadLocalEnvironment();
async function main() {
    const origin = process.argv.find(a => a.startsWith('--origin='))?.slice('--origin='.length);
    if (origin)
        process.env.NEXT_PUBLIC_APP_URL = origin;
    const { oauthCallback, oauthClient, oauthOrigin } = await import('../src/core/auth/oauth-config');
    const result: Record<string, unknown> = { origin: oauthOrigin(), note: 'Checks client authentication using an intentionally invalid code. No user signs in and no tokens are issued.' };
    let failed = false;
    for (const provider of ['google', 'github'] as const) {
        try {
            const client = oauthClient(provider);
            const callback = oauthCallback(provider);
            const response = await fetch(provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://github.com/login/oauth/access_token', { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret, code: 'zerivex-intentionally-invalid-preflight-code', grant_type: 'authorization_code', redirect_uri: callback }) });
            const body = await response.json().catch(() => ({}));
            const accepted = ['invalid_grant', 'bad_verification_code'].includes(body.error);
            if (!accepted)
                failed = true;
            const code = ['invalid_grant', 'bad_verification_code', 'incorrect_client_credentials', 'invalid_client', 'redirect_uri_mismatch'].includes(body.error) ? body.error : 'unknown';
            result[provider] = { clientId: client.clientId, callback, credentialCheck: accepted ? 'client accepted; invalid test code rejected as expected' : 'needs configuration review', providerError: code };
        }
        catch {
            failed = true;
            result[provider] = { credentialCheck: 'configuration or network unavailable' };
        }
    }
    console.log(JSON.stringify(result, null, 2));
    if (failed)
        process.exitCode = 1;
}
main().catch(() => { console.error('OAuth configuration check failed; no credentials were logged.'); process.exitCode = 1; });
