# ADR-0002: Four-Tier Separation of Authentication, Authorization, Entitlements, and Tenant Scoping

> **Status:** APPROVED  
> **Date:** 2026-09-22  
> **Deciders:** Lead Product Architect, Lead Security Engineer  

---

## 1. Context
A common architectural failure in SaaS applications is consolidating authorization, subscription tiers, and tenant boundaries into a single boolean or simplistic check (e.g. `isAdmin`, `isPremium`, or checking role without checking organization ID). This causes critical privilege escalations, BOLA/IDOR vulnerabilities, and accidental lockouts for platform owners.

## 2. Decision
Enforce strict separation across four distinct conceptual layers:

1. **Authentication:** *"Who are you?"* Resolves the caller from their session to a specific `User` record and verified identities.
2. **Platform Role (RBAC):** *"What platform administrative capabilities do you possess?"* Roles: `OWNER`, `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `USER`.
3. **Tenant Scoping:** *"Which organization and project resources are you authorized to touch?"* Enforced via mandatory `organization_id` filters on every query.
4. **Subscription Entitlements:** *"What platform capabilities does your organization's plan permit?"* Plan levels: `FREE`, `STARTER`, `PRO`, `TEAM`, `ENTERPRISE`.

### The Owner Entitlement Rule
The `OWNER` role receives full platform entitlement by explicit server-side policy:
```typescript
if (user.role === 'OWNER') {
  return { authorized: true, reason: 'PLATFORM_OWNER' };
}
return evaluateSubscriptionPlan(organizationId, capability);
```
The owner account is never artificially assigned a simulated customer plan (e.g. "Enterprise") to avoid billing confusion or permission drift.

## 3. Consequences
- **Positive:** Eliminates IDOR/BOLA; allows platform operators full access without billing mutations; permits granular RBAC in enterprise organizations.
- **Negative:** Requires disciplined authorization middleware across every API route.
