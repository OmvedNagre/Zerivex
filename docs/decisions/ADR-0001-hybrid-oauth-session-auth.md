# ADR-0001: Hybrid OAuth 2.0 / OIDC with Secure Server-Side Hashed Sessions

> **Status:** APPROVED  
> **Date:** 2026-09-22  
> **Deciders:** Lead Product Architect, Lead Security Engineer  

---

## 1. Context
Zerivex requires an authentication system that avoids storing plaintext or easily compromised credentials, resists token theft via XSS, survives browser refreshes and tab transitions, and supports identity linking across multiple providers (Google and GitHub). Storing JWTs or raw credentials in `localStorage` exposes users to catastrophic token theft if any client script or third-party dependency is compromised.

## 2. Decision
1. Implement **OAuth 2.0 / OpenID Connect** (Google and GitHub) using the Authorization Code Flow with PKCE, server-side code exchange, and state/nonce validation.
2. Maintain persistent sessions using server-side **opaque 256-bit cryptographically random tokens** stored exclusively in an HTTP-only, secure, strict cookie (`__Host-zerivex_session`).
3. Store only the **SHA-256 hash** of the session token in the database.
4. Support session revocation ("Sign Out" and "Sign Out All Other Sessions") by invalidating records in the database.
5. Provide a mock OAuth adapter for automated security test suites to run completely offline without relying on external network calls.

## 3. Alternatives Considered
- *Stateless JWTs in LocalStorage:* Rejected due to high vulnerability to XSS token exfiltration, inability to perform immediate session revocation, and exposure to token leakage.
- *Username/Password Auth (Phase 1):* Postponed to later phases to minimize custom credential storage and brute-force attack surface during initial release.
- *Third-Party Auth Services (Clerk/Auth0/Firebase):* Rejected to maintain full sovereignty over user identities, database transactions, session revocation, and server-side authorization.

## 4. Consequences
- **Positive:** Maximum resistance to credential theft; instant session revocation; seamless user experience across page refreshes and browser tabs.
- **Negative:** Requires stateful session lookups in PostgreSQL (mitigated via database indexes and in-memory connection pooling).
