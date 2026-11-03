# Google, GitHub and staff sign-in

The customer Google and GitHub flows use server-held, single-use login attempts. Each attempt is bound to its provider, purpose, browser cookie, expiry and exact redirect URI. PKCE is used for both providers. PKCE verifiers and return paths are encrypted; raw OAuth state and browser bindings are only stored as hashes. Tokens remain server-side and are used only to obtain a verified provider identity.

Accounts, workspace membership, explicit owner/staff roles and existing application session cookies are preserved. First-time verified sign-in creates an ordinary USER account. Google/GitHub accounts can link through an already verified email; sign-in never grants a platform role. Suspended accounts are rejected. Staff sign-in has a separate handshake and staff-only cookie; it requires a verified Google identity, allowlist and active platform role, and cannot create a new staff account.

## Deploy this rebuild

1. Apply migrations 017 and 018 against the database used by Vercel before deploying these routes. They add only temporary login-attempt storage; no account data is removed. `npm run db:migrate` uses the database configured in that shell.
2. Choose one primary production host. Your existing Vercel domain configuration redirects the apex to `www`, so the recommended value is `NEXT_PUBLIC_APP_URL=https://www.zerivex.tech`. Keep local development on `http://localhost:3000`.
3. Set a matching website pair in Vercel Production: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the SAME Google Web application client; `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from the SAME GitHub OAuth App. Keep Gmail sender credentials in the separate `GMAIL_*` variables. Never substitute an API key, Gmail refresh token, or Google client secret for a GitHub secret.
4. Register callback URLs below on the clients whose IDs actually appear in Vercel. Do not register website callbacks only on an unrelated invitation-mail client.
5. Redeploy after changing runtime secrets. Clear old in-progress login attempts by starting a fresh login; old OAuth callbacks are not reusable.

Google website client callbacks:

```text
https://www.zerivex.tech/api/auth/callback/google
https://www.zerivex.tech/api/staff/auth/callback
```

If you also serve the apex directly, register the corresponding `https://zerivex.tech/...` Google callbacks. The rebuild permits only the configured origin and its exact HTTPS www/apex counterpart, not arbitrary Host headers. It remembers whichever callback began that specific attempt and uses the identical URI at token exchange.

GitHub production OAuth App settings:

```text
Homepage URL: https://www.zerivex.tech
Authorization callback URL: https://www.zerivex.tech/api/auth/callback/github
```

Use a separate GitHub OAuth App for localhost, configured with `http://localhost:3000/api/auth/callback/github`. Keep development and production client credentials in their respective environments.

Gmail authorization remains independent; its connection helper uses `http://127.0.0.1:5367/oauth/callback`. Rebuilding website sign-in does not authorise Gmail sending or require resetting an already connected sender.

## Check credentials without sharing secrets

Run against local settings:

```bash
npm run auth:check
```

For an explicitly configured production credential file stored privately as `.env.production.local`:

```bash
node --env-file=.env.production.local --import tsx scripts/check-oauth.ts --origin=https://www.zerivex.tech
```

The file must be ignored by Git. This command sends a deliberately invalid test code to the real token endpoints. `invalid_grant` (Google) or `bad_verification_code` (GitHub) means the endpoint accepted client authentication and rejected the fake code as expected. `invalid_client` or `incorrect_client_credentials` identifies a credential problem. The check prints only public client IDs, callbacks and allowlisted error categories. It does not prove that callback registration, provider consent or a real user's complete sign-in works.

## Acceptance checklist

- New Google user and new GitHub user can sign in and receive ordinary USER sessions.
- Existing owner keeps the same account, workspace and role.
- Invitation links return to their original safe path after first-time sign-in.
- A replay, missing browser binding, expired attempt, wrong provider or wrong customer/staff purpose cannot create a session.
- A signed-in provider account without a verified email is rejected.
- Staff → Sign in uses `/api/staff/auth/login`; only an existing allowed staff user receives the separate staff session.
- Declining provider consent returns a clear error and clears the temporary cookie.
- Client-secret failures, rejected codes, profile failures and database/account failures have distinct messages and a safe support reference.

## Troubleshooting

`oauth_client_config`: check the ID/secret pair on the current production deployment. Rewriting code cannot make an incorrect provider secret valid.

`oauth_redirect_config`: compare the exact callback on the provider's client settings to the login request. Scheme, www, port and path matter.

`invalid_state`: start a fresh login in the same browser. Do not reuse an old callback URL or jump between unrelated deployment hosts.

`oauth_start_failed` / `account_setup_failed`: inspect safe server logs and ensure migrations are applied to the actual deployment database, not only a local database.

Only share the safe reference and error category with support. Do not share OAuth codes, state values, cookies, refresh tokens or secrets.

Sources: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [GitHub OAuth authorisation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

## Implementation verification

- TypeScript check and production build: passed.
- Unit suite: 284 passed across 24 files, covering callback origin validation, provider response validation, PKCE and safe errors.
- Focused database OAuth suite: 10 passed, including complete Google/GitHub callbacks, single-use/replay/expiry checks, customer/staff separation and explicit staff role enforcement.
- Final focused browser suite: 10 passed across desktop/mobile, including provider starts, dedicated staff login navigation and invitation onboarding.
- An earlier full isolated database/security run passed 524 checks and reported one staff-route callback assertion while the staff rewrite was in progress. The completed staff implementation passed the focused database and browser reruns above.
- Additive migrations 017 and 018 were applied to the currently configured database. A separate Vercel database requires those same migrations before release.
- Safe real-provider preflight: the local Google website pair was accepted and its intentionally invalid code was rejected as expected. GitHub rejected the requested `https://www.zerivex.tech/api/auth/callback/github` callback; this must be corrected in that OAuth App's settings. No real user consent or live production sign-in was performed by these automated checks.
- These changes are local source changes. They do not update Vercel environment variables, Google client registration or GitHub OAuth App settings automatically.
