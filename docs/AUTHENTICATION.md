# Zerivex Authentication & Session Architecture

---

## 1. Authentication Lifecycle

```
User visits /login
        │
        ▼
Clicks "Continue with Google" or "Continue with GitHub"
        │
        ▼
Server generates cryptographically random state & PKCE code_verifier
Sets temporary secure state cookie
Redirects browser to Provider OAuth endpoint
        │
        ▼
User approves on Provider
Provider redirects back to /api/auth/callback/{provider} with ?code=...&state=...
        │
        ▼
Zerivex Server validates state cookie against query state (CSRF defense)
Exchanges code for access token & user profile server-side
Extracts verified email identity
        │
        ▼
Database Transaction:
  1. Find or create User record
  2. Find or create Identity record
  3. Check Owner Bootstrap state:
     - If no OWNER exists and email == INITIAL_OWNER_EMAIL:
         Assign role = OWNER
         Insert platform_bootstraps record
     - Else:
         Assign role = USER
  4. Generate opaque 256-bit session token
  5. Compute SHA-256 hash and persist in sessions table
        │
        ▼
Set HttpOnly, Secure, SameSite=Lax cookie: __Host-zerivex_session
Redirect to safe destination (/dashboard or validated returnTo)
```

---

## 2. Session Durability Across Page Refreshes
- **State Machine:** `AUTH_LOADING` $\rightarrow$ `AUTHENTICATED` | `UNAUTHENTICATED` | `AUTH_ERROR`.
- **Rehydration:** On application mount, frontend calls `GET /api/auth/session`. While in `AUTH_LOADING`, UI renders a non-blocking skeleton, preventing redirect flashes to `/login`.
- **Single-Flight Lock:** Concurrent API requests hook onto a single in-flight session promise to avoid multiple simultaneous refresh requests.
- **Cache-Control:** Sensitive authenticated pages return `Cache-Control: no-store, no-cache, must-revalidate` to prevent back-button disclosure from browser disk cache after logout.

---

## 3. One-Time Owner Bootstrap
- `INITIAL_OWNER_EMAIL` is configured in environment variables.
- Bootstrapping is transactional and executed once.
- Once `platform_bootstraps` contains a record, `INITIAL_OWNER_EMAIL` is ignored for all future sign-ins.
- Emergency CLI recovery (`scripts/admin-bootstrap.ts`) is provided for local terminal administrator promotion, but is disabled if an owner already exists.
