# Zerivex production setup

Public URL: `https://zerivex.tech`  
Owner: `code64816@gmail.com`  
Invitation sender, Reply-To and public support: `zerivex.secure@gmail.com`

## What is implemented

- Explicit owner provisioning for the existing verified Google user and existing workspace. It renames the workspace, grants STAFF_OWNER, and records a complimentary Enterprise subscription for ten years. This is an audited organization subscription; it does not reinstate role or login bypasses. Existing Stripe subscriptions are not overwritten.
- Invitation emails have an encrypted database outbox; the worker sends them through the Gmail API. Tokens are hashed in invitations and encrypted only while queued for delivery. Ciphertext is cleared after send, cancellation or failure. Rotating SESSION_SECRET invalidates queued ciphertext: resend affected invitations.
- The API fails with 503 before creating a mail invitation if sender credentials are missing. Gmail acceptance is shown as Sent, not Delivered; Gmail supplies no delivery receipt in this integration. Ambiguous failures are not automatically retried, to avoid duplicate emails. Resend explicitly creates a fresh link and invalidates the old one.
- Acceptance requires the matching verified email, protects existing memberships and enforces seat limits under an organization lock. The accepting session switches to the joined workspace. A separate three-step team welcome flow records completion per membership.
- Worker heartbeats are independent of scan execution. Staff → Queue shows live/stale workers and queue age. `/api/health/worker` returns 503 for no live worker, overdue jobs, or database failures. It requires `Authorization: Bearer <WORKER_MONITOR_SECRET>`; use a random secret of at least 32 characters.

## 1. Connect Gmail once

1. In Google Cloud, enable the Gmail API. Configure OAuth consent and create a Web OAuth client for this sender connection. Keep this separate from customer sign-in if possible.
2. Register this exact local redirect URI: `http://127.0.0.1:5367/oauth/callback`.
3. Put `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in ignored `.env.local`; do not commit them or send them through chat. In testing mode, add `zerivex.secure@gmail.com` as a test user.
4. Run `npm run mail:connect`, open the displayed consent URL, choose **zerivex.secure@gmail.com**, and authorize sending. The callback verifies the sender identity and writes `GMAIL_REFRESH_TOKEN` into ignored `.env.local` without printing it. It does not send an email.
5. Store those three values securely in Vercel production environment variables. This flow requests only identity/email and `gmail.send`, not access to read your inbox. Replies arrive in Gmail normally.
6. OAuth testing status can cause refresh-token expiration; complete the appropriate Google consent configuration before relying on unattended production delivery. An account password is never needed here.

Source: [Gmail sending guide](https://developers.google.com/workspace/gmail/api/guides/sending), [scope reference](https://developers.google.com/workspace/gmail/api/auth/scopes).

## 2. Connect Vercel and the domain

1. Sign in to Vercel and import this repository with the completed changes. Select Next.js. Use a plan whose terms permit your intended commercial service.
2. Configure production environment values before deployment:
   - `NEXT_PUBLIC_APP_URL=https://zerivex.tech`
   - `NEXT_PUBLIC_CONTACT_EMAIL=zerivex.secure@gmail.com`
   - `DATABASE_URL` (provider's pooled URL), `DATABASE_DIRECT_URL` for migrations
   - `SESSION_SECRET` (same value for web and worker)
   - Google/GitHub sign-in client credentials
   - `STAFF_ALLOWED_EMAILS=code64816@gmail.com`
   - The three Gmail variables above
   - `WORKER_HEALTH_PORT=8081`
   - `WORKER_MONITOR_SECRET` (random, minimum 32 characters)
   - Legal operator/jurisdiction/approval and Stripe variables when those launch requirements are fulfilled
3. Migrate the actual production database with `npm run db:migrate` before promoting the release. Local database setup does not migrate a different deployment database.
4. Attach `zerivex.tech` in Vercel Domains and add the exact DNS records Vercel returns at the registrar. Do not guess IP addresses or replace unrelated DNS records. Confirm HTTPS before updating OAuth registrations.
5. Register Google callback `https://zerivex.tech/api/auth/callback/google`, GitHub callback `https://zerivex.tech/api/auth/callback/github`, and the separate Google staff callback `https://zerivex.tech/api/staff/auth/callback` with the matching clients.
6. `vercel.json` declares one scanner daemon in `bom1`, built from `Dockerfile.worker`, with a health probe on port 8081. The worker needs the same database, session secret and Gmail settings as the web app. The container does not copy local .env files or backups.
7. Vercel Daemons currently run in production, not previews. Use a separate preview database; don't let preview web jobs enter the production queue. Confirm available region, quota and billing in your account.

Source: [Vercel Daemons](https://vercel.com/docs/daemons).

## 3. Production acceptance

- Sign in as the owner and verify Zerivex, Workspace owner and Enterprise. Sign in separately to Staff and confirm STAFF_OWNER management access.
- Confirm live worker heartbeats while idle, then queue a passive scan of a domain you own. Check progression and truthful results. Restart the daemon during a controlled test and verify unfinished work fails safely; do not retry intrusive jobs automatically.
- Configure an external uptime monitor for the protected worker endpoint, storing its bearer secret in that service. Alert on repeated 503s. A local status page alone is not external monitoring.
- Send a real invitation to a consenting test recipient, check Gmail acceptance and actual inbox receipt, and accept using that exact verified email. A different account must be rejected. Confirm the recipient lands in Zerivex with the selected role and completes welcome onboarding.
- Test expired, revoked, resent and already-accepted links; seat-cap races; existing-owner protection; and revoked membership after session selection.
- Test desktop/mobile branding, profile breadcrumbs with no console errors, support links, and legal/Stripe readiness.

No Vercel project or Gmail sender authorization was connected at implementation time. Deployment and real email acceptance remain external setup steps; do not treat a successful local build as proof they are live.

## Verification during implementation

The production build, TypeScript checks and 264 unit tests pass. The full isolated database run passed 485 checks and failed one obsolete public-contact expectation; its corrected 11-test suite passed. The invitation-specific suite passed nine checks, including concurrent acceptance for the final seat. Final browser verification results are recorded below.

The local Docker executable is installed but its daemon is stopped, so a container image build has not been verified here. Vercel must successfully build `Dockerfile.worker` before promoting production. No live invitation email has been sent, and no external monitor has been connected.

Final browser verification: the broad run passed 67/72 checks. Four failures were old team-heading/support-address assertions; one mobile target request encountered a connection reset. After correcting the assertions, the focused final run passed 14/14 desktop/mobile checks, including the target flow, breadcrumb console check, complete invitation acceptance/onboarding and authenticated idle-worker monitoring. Final TypeScript, 264 unit tests and the production build passed.

For local review, restart `npm run dev` so its worker loads the new dispatcher and heartbeat code. The owner workspace change is already applied to the currently configured database. Use `/staff/login` for the separate staff console. Customer OAuth remains required; no developer login or ownership-verification bypass was restored.
