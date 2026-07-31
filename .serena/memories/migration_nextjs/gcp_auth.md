# Firebase frontend removal plan
## Decision
- Remove `@angular/fire`/Firebase Web SDK during Next.js migration.
- Use Google Identity Services (GIS) Sign in with Google, FedCM enabled, to obtain short-lived Google OIDC ID credential. GIS authentication returns ID tokens; authorization for Google APIs is separate.
- Exchange credential server-side for app session. Never persist ID/access/refresh token in localStorage.
- Keep current FastAPI non-local verifier initially: Google `verify_oauth2_token` with configured audience, hosted-domain allowlist, JIT user provisioning, role/workspace authorization.
- Next.js runs on Cloud Run and owns encrypted/signed HttpOnly `Secure`, `SameSite=Lax` session cookie plus CSRF protection for mutations. Server session stores minimum identity/session data; browser receives no reusable backend bearer token.
## Request path
1. Login Client Component renders GIS button/One Tap with FedCM.
2. GIS callback posts credential + CSRF value to Next Route Handler.
3. Route Handler verifies signature, issuer, audience, expiry, nonce/CSRF, email, hosted domain; fetches FastAPI `/users/me` to JIT provision/profile sync.
4. Route Handler creates rotating short session and sets HttpOnly cookie.
5. Server Components/layouts read session for redirects and role-aware navigation.
6. Next BFF forwards authenticated calls to FastAPI. Preferred: server issues/forwards verified Google ID token only while available, or backend accepts a separately signed internal session assertion from Next Cloud Run service. Final mechanism requires backend contract work; browser never handles it.
7. Logout clears app cookie and disables GIS auto-select; no Firebase `signOut`.
## GCP options
- Default: GIS + app session. Smallest change, supports external Google accounts and existing OIDC verifier.
- Optional perimeter: IAP in front of Next/Cloud Run for organization-only deployments. IAP is access perimeter, not replacement for app roles/workspaces. IAP programmatic user access only supports Google identities, not Identity Platform/Workforce identities.
- Do not call this "direct GCP auth" without distinction: GIS is Google identity UI/OIDC; Identity Platform's documented web SDK is Firebase Auth SDK. Removing Firebase SDK means GIS/manual OIDC path, not Identity Platform client SDK.
## Migration tasks
1. Register Google Web OAuth client, allowed origins/redirects, consent screen, production domains; separate local/prod clients.
2. Add GIS loader/button and FedCM settings.
3. Implement credential verification/session rotation/logout/CSRF/rate limiting/security headers.
4. Add server-side `getSession`, `requireUser`, `requireRole`; keep backend authorization authoritative.
5. Replace Angular interceptor/localStorage token/user helpers with server API client and session profile.
6. Remove `@angular/fire`, Firebase initialization/environment fields, Firebase session keys and auth tests from new frontend.
7. Verify expiry, replay, audience, issuer, hosted-domain, CSRF, fixation, logout, multi-tab, disabled third-party cookies/FedCM fallback.
## Backend-later boundary
- Initial migration may add only session assertion verification endpoint/dependency if required. No auth domain rewrite.
- Later improvement can standardize FastAPI verification for Google user OIDC + internal Cloud Run service assertions and remove local Firebase Admin verification.
## Sources
- Google Identity Services overview: authentication returns ID token; FedCM recommended for new apps; authorization separated.
- GCP Identity Platform Google login docs: official client SDK path imports `firebase/auth`; manual Google sign-in is possible.
- IAP authentication docs: Google-issued OIDC and service-account auth; user programmatic constraints apply.