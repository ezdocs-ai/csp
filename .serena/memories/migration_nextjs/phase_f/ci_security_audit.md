# Phase F — CI / Security Read-Only Audit (frontend-next)

Date: 2026-07-29
Scope: `.github/workflows/frontend-next.yml`, `frontend-next/next.config.ts`, `src/middleware.ts`, `src/lib/auth/*`, `Dockerfile`, `cloudbuild.yaml`, `package.json`, `playwright.config.ts`, `.dockerignore`, `.gitignore`.
Mode: READ-ONLY. No edits made.

## 1. Blockers (P0 — break prod build/deploy/runtime)

### B1. Generated API types not committed; cloudbuild build will fail
- `git rev-parse HEAD:openapi.json` → `does not exist in 'HEAD'`
- `git rev-parse HEAD:src/lib/api/types.ts` → `does not exist in 'HEAD'`
- Both untracked on `main` (`git status` shows `??`).
- `cloudbuild.yaml` runs `docker build` with NO `gen-api` step → checkout lacks `types.ts` (213KB) → `next build` fails TypeScript.
- Local working copy works only because `bun scripts/gen-api.ts` was run and outputs sit on disk untracked.
- `.gitignore` does NOT ignore these paths (confirmed via `git check-ignore` exit 1). They are simply never `git add`-ed.

### B2. CI "Verify generated API types" step is a no-op
- Workflow step `git diff --exit-code -- openapi.json src` runs against **untracked** files → `git diff` only inspects tracked files → always exits 0.
- Drift between committed spec and regenerated types is invisible. Misleading gate.

### B3. CI `bun test` silently skips Playwright e2e (no real e2e gate)
- `tests/e2e/*.spec.ts` and `tests/visual/design-system.spec.ts` import `{ test } from "@playwright/test"`.
- Bun's test runner imports the file but Playwright's `test()` does not register with bun → bun reports 0 tests for those files.
- Effective e2e coverage in CI = 0. No `bun run test:e2e` step anywhere.
- Also `package.json` `test` script (`bun test src`) scopes to src/, but CI invokes bare `bun test` (whole repo) → scans `tests/` too. Inconsistent.

### B4. cloudbuild deploy missing all runtime config
- `gcloud run deploy` args: only `--image`, `--region`, `--quiet`. No:
  - `--set-env-vars` / `--update-env-vars` for `GOOGLE_CLIENT_ID`, `GOOGLE_HOSTED_DOMAIN`, `BACKEND_URL`, `NODE_ENV`, `PORT`.
  - `--set-secrets` / `--update-secrets` for `AUTH_SESSION_SECRET` (32+ char HS256 key).
- First login will throw `AUTH_SESSION_SECRET must contain at least 32 characters` (`session.ts:103`) → 500. Also `GOOGLE_CLIENT_ID is required` (`verify.ts:43`).
- No `--ingress` → defaults to `all`. No `--no-traffic` → 100% traffic on every commit. No `--concurrency`/`--memory`/`--cpu`/`--timeout`/`--min-instances`.

### B5. Open redirect via Host header in middleware
- `src/middleware.ts:25,30,34` builds redirect URLs from `new URL("/login", request.url)` and `new URL("/", request.url)`.
- Next.js `request.url` is derived from `Host` header (and `X-Forwarded-Host` behind proxy). No trusted-host allowlist.
- Attacker sends `Host: evil.com` → 307 `Location: https://evil.com/login?next=...`. Phishing + token-in-URL leak of `next` param.
- `next.config.ts` has no `async headers()` trusted-origin guard either.

### B6. No CSP / security headers
- `next.config.ts` is bare: `{ output: "standalone" }`. No `headers()`, no `X-Content-Type-Options`, no `X-Frame-Options`/`frame-ancestors`, no `Referrer-Policy`, no `Strict-Transport-Security`, no `Permissions-Policy`.
- Login page loads Google Identity Services from `accounts.google.com` — needs explicit CSP `script-src`/`frame-src` allowlist once CSP is added (else GIS breaks).
- Google `accounts.google.com/gsi/client` typically needs `script-src https://accounts.google.com/gsi/` `frame-src https://accounts.google.com/gsi/`.

## 2. High (P1)

### H1. Bun version drift CI vs Docker
- CI pins `oven-sh/setup-bun@v2` with `bun-version: "1.2.19"`.
- Dockerfile uses `oven/bun:1-alpine` (floating 1.x). Drift can change lockfile resolution. Pin to `oven/bun:1.2.19-alpine`.

### H2. Session JWT embeds full Google ID token
- `session.ts:41` signs `{ ..., idToken }` into HS256 JWT. If session secret leaks, attacker gets fresh Google ID token (valid until Google exp). Consider storing only sub/email/roles + a server-side lookup, or short-TTL the idToken.

### H3. `verifySession` does not pin iss/aud
- `session.ts:52` only pins `algorithms: ["HS256"]`. For self-signed session JWT this is acceptable, but add `issuer`/`audience` checks for defense-in-depth (cheap).

### H4. Logout cookie clear may not match set cookie
- `clearSessionCookie()` returns `{ ...sessionCookie(""), maxAge: 0 }`. `sessionCookie("")` has `secure: NODE_ENV === "production"`. Matches set path. OK — but missing `expires` past date. Some clients prefer `expires: epoch`. Minor.

### H5. No production browser source maps control
- `next.config.ts` does not set `productionBrowserSourceMaps`. Default = false (good for prod). But also no `serverSourceMaps` config — fine. Just confirm intent: prod should NOT ship source maps. Add explicit `productionBrowserSourceMaps: false` for clarity + add `serverExternalPackages` if needed.

## 3. Medium (P2)

### M1. cloudbuild has no test/lint/typecheck gate
- Only build → push → deploy. CI workflow runs lint/typecheck/test/build, but cloudbuild does NOT depend on CI status. A bad commit on `main` (CI failing) still deploys. Add `--substitutions=_SHORT_SHA=$SHORT_SHA` and trigger only on green CI, or run `bun run lint && bunx tsc --noEmit && bun test` before `docker build` in cloudbuild.

### M2. Dockerfile single-stage build runs full repo context
- `COPY . .` after `.dockerignore` filters. `.dockerignore` excludes `*.md`, `node_modules`, `.next`, `.git`, `openapi.json`, `**/*.test.*`, `**/*.spec.*`. Good.
- But `.dockerignore` excludes `*.md` yet whitelists only `!AGENTS.md` — inconsistent (CLAUDE.md, README.md, tridorian-*.md excluded; only AGENTS.md kept). Either drop the whitelist or include all agent docs.
- `tsconfig.tsbuildinfo` (40KB) committed + copied into image — wasted. Add to `.dockerignore`.

### M3. Cache correctness in CI
- `actions/cache@v4` key `${{ runner.os }}-bun-${{ hashFiles('frontend-next/bun.lock') }}`. `hashFiles` uses workspace root → `frontend-next/bun.lock` correct. Path list OK.
- BUT: cache shared across `lint`/`typecheck`/`build` runs in same job — `.next/cache` only relevant for build step. Fine.
- No cache for `playwright` browsers (irrelevant since e2e not run). If e2e added later, cache `~/.cache/ms-playwright`.

### M4. `package.json` `gen:api` script wrong cwd
- `"gen:api": "bun --cwd frontend-next scripts/gen-api.ts"` — but `package.json` lives IN `frontend-next`. So `--cwd frontend-next` looks for `frontend-next/frontend-next`. Broken when invoked from frontend-next dir. CI sidesteps by calling `bun scripts/gen-api.ts` directly. Fix: `"gen:api": "bun scripts/gen-api.ts"`.

### M5. `start` script unused by Docker
- `package.json` `start` = `next start`. Docker uses `node server.js` (standalone). Fine, but `next start` would NOT use standalone build — keep current Docker CMD. No change needed, just note.

### M6. No health/readiness probe in cloudbuild
- Cloud Run uses default liveness (HTTP GET `/` on `$PORT`). `/` returns 307 redirect to /login → Cloud Run treats 2xx-3xx as healthy. OK by default, but explicit `--set-cloudsql-instances` N/A here. Recommend custom health route `/api/health` returning 200 and `--set-healthchecks` if added.

## 4. Low (P3)
- L1. `.gitignore` lacks `tsconfig.tsbuildinfo` (file present, 40KB). Add.
- L2. `tests/fixtures/routes.ts` and `tests/visual/` — confirm these are intentional (visual regression suite not wired to CI).
- L3. `frontend-next/noop`, `frontend-next/THIS_SHOULD_NOT_EXIST` — leftover scratch files in repo root. Remove.
- L4. Session TTL 15 min (`SESSION_TTL_SECONDS = 15 * 60`). No sliding refresh. `rotateSession` exists but not called anywhere in middleware. Long sessions die silently. Consider refresh on each request in middleware.
- L5. CSRF: double-submit cookie `csp_csrf` (httpOnly=false, sameSite=lax). Login route reads `csrfToken` from JSON body, logout from `x-csrf-token` header. Inconsistent transport. Standardize.
- L6. `console.error` used in login/logout routes — fine for Cloud Run stdout, but consider structured logger.

## 5. Verified OK
- Docker non-root: `USER next` (uid 1001), `COPY --chown=next:next`. node:20-alpine base. Good.
- Session cookie: `httpOnly: true`, `secure: NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`. Production-acceptable.
- HS256 key length enforced (≥32 chars).
- Google ID token verification: `verifyIdToken` with audience pin, `email_verified === true`, issuer allowlist, optional `GOOGLE_HOSTED_DOMAIN` check. Good.
- CSRF verify uses constant-time compare (XOR accumulator). Good.
- Middleware matcher excludes `api`, `_next`, `login`, static, files. Good.
- `server-only` import in `src/lib/auth/server.ts` prevents client import. Good.

## 6. Proposed Write Set (for next phase, NOT executed here)

| # | File | Change |
|---|------|--------|
| 1 | `frontend-next/src/lib/api/types.ts` | `git add` + commit (regenerated via `bun scripts/gen-api.ts`) |
| 2 | `frontend-next/openapi.json` | `git add` + commit (or add to `.gitignore` if regenerated in cloudbuild) |
| 3 | `frontend-next/cloudbuild.yaml` | Add `gen-api` step before `docker build`; add `--set-env-vars`, `--set-secrets`, `--ingress=internal-and-cloud-load-balancing`, `--no-traffic` (or staged), healthcheck flags |
| 4 | `frontend-next/next.config.ts` | Add `headers()` with CSP + security headers; `productionBrowserSourceMaps: false`; trusted-host helper |
| 5 | `frontend-next/src/middleware.ts` | Validate `request.headers.get("host")` against allowlist before building redirect URL; or use `request.nextUrl.origin` after Next validates host |
| 6 | `frontend-next/Dockerfile` | Pin `oven/bun:1.2.19-alpine`; optionally run `bun scripts/gen-api.ts` in build stage if types not committed |
| 7 | `.github/workflows/frontend-next.yml` | Replace broken `git diff` verify with explicit `git add -N` + `git diff --exit-code`; scope `bun test` to `src`; add `bun run test:e2e` job (with browser cache + `webServer` reuse); add `actions/cache` for Playwright |
| 8 | `frontend-next/package.json` | Fix `gen:api` cwd; add `prebuild: bun scripts/gen-api.ts` |
| 9 | `frontend-next/.dockerignore` | Drop `!AGENTS.md` whitelist (or extend); add `tsconfig.tsbuildinfo` |
| 10 | `frontend-next/.gitignore` | Add `tsconfig.tsbuildinfo` |
| 11 | Cleanup | Remove `frontend-next/noop`, `frontend-next/THIS_SHOULD_NOT_EXIST` |

## 7. Open Questions
- Is `openapi.json` source-of-truth (committed) or derived (regenerated from backend at build)? Decision drives B1/B2 fix.
- Are Playwright e2e tests expected to run in CI? Currently 0 coverage.
- Trusted hosts: list of allowed production hostnames (Cloud Run domain + custom domain)?
- Secret manager: which GCP Secret Manager secrets back `AUTH_SESSION_SECRET`, `GOOGLE_CLIENT_ID`?
