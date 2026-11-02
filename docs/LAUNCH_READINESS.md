> Follow-up: owner/workspace provisioning and invitation/worker implementation are documented in [the production setup guide](DEPLOY_ZERIVEX_TECH.md). Current public support and sender: zerivex.secure@gmail.com; owner remains code64816@gmail.com. Vercel and Gmail account connections remain pending.

# Launch readiness audit — 2 November 2026

**Verdict: not approved for a public paid launch yet.** Local source checks cannot certify an undeployed production system. The previous launch checklist contains historical claims and is not current acceptance evidence.

## Scope and completed corrections

- Customer and staff navigation, layouts, dialogs, errors, empty states, responsive tables, accessibility and typography were reviewed through the desktop/mobile browser suite. Customer pages follow the newer warm paper design; the separately authenticated staff workspace retains its own styling.
- Removed Localhost Developer login and mock OAuth routes, automatic email-based OWNER promotion, customer OWNER quota/feature exceptions, staff subscription overrides and plan-preview controls. Staff console authentication and explicit provisioning remain available.
- Removed instant/manual domain verification. Ownership must pass an actual supported DNS/HTTP proof. Historical proofs require the cutover below.
- Removed payment simulation. Missing Stripe configuration returns an unavailable error instead of pretending a checkout succeeded. A URL query cannot activate a subscription.
- Rebuilt the public comparison table from canonical plan definitions: Starter, Pro, Team and Enterprise, matching their actual feature flags and engine lists. Corrected scan-allowance, retest and SLA wording.
- Customer scan creation now queues work instead of executing the scanner inside the request. The scan detail page polls for progress. A running worker is therefore required.
- On Vercel, CI synchronous execution is rejected before creating a job. Generated CI snippets request asynchronous execution, poll to completion with a bound, and fail on failed/incomplete scans. Snippets use the configured application URL.
- Vercel client IP handling uses its controlled forwarding header instead of trusting arbitrary Cloudflare/X-Forwarded-For values.
- Billing return URLs prefer the configured application origin.
- Added regression tests for retired endpoints, rejected manual proof, non-promotion, subscription enforcement for staff/owners, and trusted Vercel ingress.

## Pricing checked against source

| Plan | Monthly INR | Annual INR | Targets | Scans/month | Members |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starter | 0 | 0 | 1 | 8 | 1 |
| Pro | 1,499 | 14,990 | 3 | 50 | 3 |
| Team | 4,999 | 49,990 | 15 | 250 | 10 |
| Enterprise | Agreement | Agreement | Agreement | Agreement | Agreement |

These are configured prices, not an assessment of profitability. Taxes, payment fees, refunds, support effort and scanner hosting costs need commercial validation. Enterprise is not a self-service checkout plan. Failed jobs consume the reserved monthly allowance as described in the revised FAQ.

## Launch blockers and acceptance criteria

| Priority | Finding | Required completion |
| --- | --- | --- |
| Blocker | Local application URL is still localhost | Choose the stable public HTTPS URL, configure production environment and register matching Google/GitHub customer and staff callbacks. Test sign-in, logout and return paths on that URL. |
| Blocker | Stripe secret and webhook secret are absent | Configure Stripe securely in hosting settings, configure products/prices and webhook endpoint, then verify checkout, signature rejection, duplicate events, activation, cancellation and customer portal using real provider test mode before live mode. Do not paste secrets in chat. |
| Blocker | Worker deployment is unverified | Provision `npm run worker` as a persistent service with database/network access. Demonstrate queued scan execution, scheduled scans, shutdown/restart recovery and failed/unreachable targets. Website deployment alone does not start this process. |
| Blocker | Legal policies remain drafts | Operator is Zerivex and contact is code64816@gmail.com. Governing jurisdiction and operator approval remain missing. `LEGAL_POLICIES_APPROVED=true` must reflect actual review; do not set it to bypass review. |
| Resolved | Legacy development access existed in stored data | Migration 015 applied after verified recovery. It revokes sessions linked to mock identities, clears plan previews and revokes targets whose latest successful proof was manual. Accounts, roles and audit history remain. Affected users sign in again and affected targets prove ownership again. |
| High | Production acceptance has not occurred | Run browser smoke tests against the deployed URL, with separate production/preview data and secrets. Confirm HTTPS cookies, CSRF, tenant isolation, security headers, proxy rate limiting and staff access. |
| High | Operational recovery is not established | Configure ongoing backups, retention, restore drills, worker/queue alerts and error monitoring. A local backup does not prove production recovery. |
| High | Production connection capacity is unmeasured | Use the database provider's pooled connection URL for application traffic and direct URL for migrations. Load-test total pools across Vercel instances and workers; the current pool maximum is 20 per process. |
| Medium | Custom-domain transition needs configuration updates | After moving from vercel.app, update application origin, provider callbacks, Stripe webhook/return URLs and any hardcoded marketing/security/SARIF URLs. Audit the remaining `zerivex.com` references before publishing a different domain. |

## Hosting and domain considerations

Vercel Hobby is limited to personal, non-commercial use. Choose a plan appropriate for a paid SaaS: [official plan terms](https://vercel.com/docs/plans/hobby).

Vercel supports persistent processes through [Daemons](https://vercel.com/docs/daemons); an external worker service is another option. This repository still needs an explicit worker deployment and acceptance, regardless of the chosen provider.

The [GitHub Student Developer Pack](https://education.github.com/pack) lists one standard .TECH domain free for one year, subject to eligibility and redemption terms. Renewal costs and name availability must be checked. A custom domain can follow an initial stable vercel.app deployment.

## Data cutover

A public-schema backup was restored into a disposable database and all 38 table counts matched before migration 015 was applied. The post-cutover audit reports zero currently verified targets whose latest proof was manual. Legacy mock identity records remain as history; no mock authentication route remains. The backup utility now excludes transient test schemas and restores cleanly into a fresh database.

## Verification record

See the final execution results below. Browser and isolated integration checks validate source behavior against test fixtures; they do not validate live OAuth consent, payments, DNS, deployed worker networking or production capacity.

- TypeScript: passed.
- Production build: passed.
- Unit tests: 264 passed across 22 files.
- Full isolated database run: 479 passed, two obsolete bypass expectations failed; corrected denial/unchanged-state assertions then passed in a focused rerun of both suites (42/42). The full run preceded the five new cutover unit tests; those pass in the unit run.
- Full desktop/mobile browser run: 68 passed, two obsolete billing simulation-message assertions failed. Focused rerun on the final source passed all four desktop/mobile checks, including corrected billing feedback and additional launch/pricing checks.
- npm audit: zero reported vulnerabilities at audit time.
- Migration 015: applied following a successful backup/restore comparison across 38 tables.
- Post-migration database check: zero active mock-linked sessions; zero verified targets with latest manual proof. Historical identity and audit records retained.
- No production deployment, live payment, external domain registration or production OAuth acceptance was performed.

Final focused browser acceptance: 4/4 passed. It verifies mock login rejection, retired consent/showcase routes, all four public pricing columns, canonical Pro CTA and absence of simulated-payment success.
