# Phase F — Final Security/CI Review (frontend-next) — READ-ONLY

Scope: next.config.ts, src/middleware.ts, src/lib/security/**, app/api/health/route.ts,
playwright.config.ts, tests/e2e/smoke.spec.ts, .github/workflows/frontend-next.yml,
relevant auth/media consumers. Docs consulted via Context7: Next.js 16.2.9, Google Identity
Services (GIS/FedCM), Playwright, GitHub Actions, Bun.

Verdict: NO hard blockers. Ship-ready. Several non-blocking recommendations below.

## VERIFIED OK

### CSP (src/lib/security/headers.ts) — PASS
- Profile matches official Next.js 16 "CSP without nonces" guide (script-src 'self'
  'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri/form-action
  'self'; frame-ancestors 'none' prod / 'self' dev; upgrade-insecure-requests prod only).
- GIS coverage correct: script-src + connect-src + frame-src = https://accounts.google.com.
  Covers gsi/client script, One Tap iframe, and FedCM fedcm.json (connect-src). Docs note
  Google suggests parent https://accounts.google.com/gsi/ to minimize churn; current broader
  host is a superset and works.
- Media coverage correct for all consumers:
  * img-src 'self' data: blob: https://storage.googleapis.com https://*.storage.googleapis.com
    https://lh3.googleusercontent.com https://*.googleusercontent.com
  * blob: covers Cropper canvas->blob URLs (cropper.tsx) and asset-picker previews.
  * storage.googleapis.com covers presigned GCS media (gallery/asset-detail/media-card use).
  * googleusercontent.com covers Google profile avatars (sidebar/users-table/gallery-detail).
- connect-src excludes GCS/googleapis by design (media served as <img>, not fetch). Correct.
- Dev profile adds 'unsafe-eval' + ws:/wss: for HMR; omits upgrade-insecure-requests so the
  ws:// HMR socket is not rewritten to wss://. Matches Next dev requirements.

### Auth (src/lib/auth/**) — PASS
- session.ts: HS256 JWT, AUTH_SESSION_SECRET enforced >=32 chars, 15-min TTL, jti, httpOnly +
  secure(prod) + sameSite=lax cookie. Constant-time CSRF compare (verifyCsrf). Solid.
- verify.ts: verifyIdToken checks audience=clientId, email_verified===true, issuer in
  {accounts.google.com}; optional GOOGLE_HOSTED_DOMAIN enforcement. Correct per GIS guidance.
- server.ts: requireUser (redirect) / requireRole / requireApiClient (throws 401). API routes
  use requireApiClient; admin routes additionally requireRole(["admin"]). Defense-in-depth
  holds even though middleware matcher excludes /api/*.

### Middleware (src/middleware.ts) + hosts (src/lib/security/hosts.ts) — PASS
- Host-header/open-redirect guard runs BEFORE any request.url-based redirect. Good.
- Suffix wildcard matching is correct: "*.run.app" => host.endsWith(".run.app"); rejects
  run.app, notrun.app, evil.run.app.evil.com (unit-tested in hosts.test.ts).
- Role gates for /admin and /workflows mirror Angular guards (workflows.guard.ts).

### Health route (app/api/health/route.ts) — PASS
- Liveness-only {status:"ok"}, no info disclosure. Unauthenticated by design (matcher
  excludes /api/*). ponytail comment documents upgrade path (503 on dep failure).

### Playwright (playwright.config.ts, smoke.spec.ts) — PASS
- storageState is NOT set globally. Confirmed against Playwright docs: a global storageState
  applies to ALL tests incl. unauthenticated. Here it is opt-in per describe via
  test.use({storageState}) + test.skip when E2E_STORAGE_STATE absent. Unauthenticated
  liveness/login/redirect smoke always run on clean context. Correct design.
- webServer auto-start only for localhost; staging/prod probed directly (prod auth intact).

### CI workflow (.github/workflows/frontend-next.yml) — PASS
- Generated API diff gate: `git add -N openapi.json src/lib/api/types.ts` then
  `git diff --exit-code`. intent-to-add surfaces untracked generated files as diffs; fails on
  both drift and new untracked. Neither path is gitignored (verified .gitignore). Solid gate.
- Bun --frozen-lockfile, oven-sh/setup-bun@v2 pin 1.2.19, actions/cache@v4, upload-artifact@v4.
- E2E_STORAGE_STATE_JSON written from secret to job-local .e2e-auth/ (gitignored).
  authenticate-smoke degrades gracefully (skip) when secret unset.

## NON-BLOCKING RECOMMENDATIONS

1. allowedDevOrigins hardcoded ["3000.avei.ovh"] (next.config.ts L25).
   - Personal dev domain in shared repo config. DEV-ONLY (Next docs: only relaxes dev-server
     cross-origin HMR/resource loads), zero production impact.
   - Action: env-drive it or drop it. Cosmetic.

2. ALLOWED_HOSTS wildcard defaults (*.run.app / *.web.app / *.firebaseapp.com).
   - Safe out-of-box for Cloud Run/Firebase; broad suffix means any *.run.app host passes the
     Host guard. Low practical risk (requires DNS/proxy-level spoof against real server).
   - Action: set explicit ALLOWED_HOSTS in prod env (code comment already recommends this).

3. Session TTL 15 min, no activity-based rotation wired.
   - rotateSession() exists but is not invoked from middleware (no sliding window).
   - Side effect: authenticated E2E smoke needs fresh storage state per run (workflow comment
     acknowledges). Risk = silent skip/flaky, NOT security.
   - Action (optional): wire rotateSession into middleware for sliding expiry.

4. CSP uses broad https://accounts.google.com for connect-src.
   - Works; Google recommends parent https://accounts.google.com/gsi/ to minimize failures on
     future GIS path changes. Optional tightening only.

5. idToken embedded in session JWT.
   - Required for backend role calls (Authorization: Bearer). Bounded by 15-min TTL + >=32-char
     secret. Acceptable; rotate AUTH_SESSION_SECRET periodically.

6. 'unsafe-inline' in script-src/style-src.
   - Documented nonce-less tradeoff for inline Next runtime. Upgrade path = nonce middleware
     (noted in headers.ts comment). Defer.

## BLOCKERS: none.
