# ADR-0008: Explicit Target Verification Scopes for Scanning Authorization

> **Status:** APPROVED  
> **Date:** 2026-09-22  
> **Deciders:** Lead Product Architect, Lead Security Engineer  

---

## 1. Context
Target domain ownership verification must not grant arbitrary lateral authorization. For example, verifying control over an apex domain (`example.com`) or a specific staging URL must not implicitly authorize aggressive active scanning against third-party SaaS endpoints, unverified subdomains (`internal.example.com`), or cloud infrastructure not directly controlled by the user.

## 2. Decision
All target records must define an explicit `verification_scope`:

1. `EXACT_HOST`: Authorizes scanning strictly against the specified hostname (e.g. `app.example.com`).
2. `DOMAIN`: Authorizes the root domain and first-party paths (e.g. `example.com/*`).
3. `SUBDOMAIN_WILDCARD`: Authorizes all subdomains (`*.example.com`), strictly requiring DNS TXT verification at the root domain level.
4. `URL_PATH`: Authorizes scanning limited to a specific URL prefix (e.g. `example.com/team-portal/`).

Before any active or intrusive scan is initiated, the target normalization engine resolves the requested target URL against the organization's verified scopes. If the target falls outside verified boundaries, active scanning is strictly rejected.

## 3. Consequences
- **Positive:** Eliminates lateral scan unauthorized targeting; provides clear auditability of customer testing authorization.
- **Negative:** Requires users to configure explicit verification records for different deployment environments.
