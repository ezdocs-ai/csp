# Phase F — Next.js Security Hardening (frontend-next)

Next 16.2.11, App Router, `output: "standalone"`, bun + eslint. Docs read from
`node_modules/next/dist/docs/` (CSP guide, `headers.md`, `productionBrowserSourceMaps.md`,
`route.md`). NOTE: next.config `.cjs`/`.cts` unsupported; `.ts` OK. `.config` must export
single `default`; removed stray `module.exports` that was shadowed.

## Files owned
- `next.config.ts` — rewritten.
- `src/middleware.ts` — host guard added.
- `app/api/health/route.ts` — NEW.
- `src/lib/security/headers.ts` — NEW pure CSP builder.
- `src/lib/security/hosts.ts` — NEW pure host allowlist helpers.
- `src/lib/security/__tests__/headers.test.ts`, `hosts.test.ts` — NEW (6 tests).

## next.config.ts
- `buildContentSecurityPolicy({dev})` imported from `./src/lib/security/headers`
  (relative import — `@/` alias not resolvable in next.config at runtime).
- `headers()` source `/:path*` emits: CSP, Referrer-Policy
  `strict-origin-when-cross-origin`, X-Content-Type-Options `nosniff`,
  X-Frame-Options `DENY` (legacy fallback for frame-ancestors), Permissions-Policy
  `camera=(), microphone=(), geolocation=(), browsing-topics=()`.
- HSTS `max-age=63072000; includeSubDomains; preload` — **prod only** (NODE_ENV gate).
  Cloud Run/Firebase terminate TLS upstream.
- `poweredByHeader: false`, `productionBrowserSourceMaps: false` (no client sourcemaps).
- Kept `allowedDevOrigins: ["3000.avei.ovh"]`, `output: "standalone"`.

## CSP profile (nonce-less; documented "Without Nonces" path)
- `script-src 'self' 'unsafe-inline' https://accounts.google.com` (+`'unsafe-eval'` dev
  for HMR/React Refresh). `unsafe-inline` mandatory without nonce/SRI middleware.
- `frame-src https://accounts.google.com` — GIS One Tap/FedCM iframe.
- `connect-src 'self' https://accounts.google.com` (+`ws: wss:` dev for HMR socket).
- `img-src 'self' data: blob: https://storage.googleapis.com https://*.storage.googleapis.com
  https://lh3.googleusercontent.com https://*.googleusercontent.com` — signed GCS media
  (`presignedUrls`/`presignedThumbnailUrls`) + Google avatars.
- `frame-ancestors 'none'` prod / `'self'` dev. App is standalone, no self-embedding found.
- `object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` (prod
  only — would break dev ws:// HMR).
- Upgrade path to tighten later: nonce middleware (docs `content-security-policy.md` →
  "Adding a nonce with Proxy") or experimental SRI (`experimental.sri.algorithm`).

## Health route (`app/api/health/route.ts`)
- `GET` → `Response.json({status:"ok"}, {headers:{"cache-control":"no-store"}})`. 200.
- Unauthenticated by design: middleware matcher `/((?!api|...))` already excludes all
  `/api/*`. Dependency-free, no DB/session/backend, no secrets.

## Trusted-host validation (`src/lib/security/hosts.ts`, wired in middleware)
- `parseAllowedHosts(env)` → comma-split, trim, lowercase, drop empty. Reads `ALLOWED_HOSTS`.
- `isAllowedHost(host, allowed)`: strips port, case-insensitive, suffix-only wildcard
  (`*.run.app` matches `a.run.app`, not `xrun.app`).
- Empty allowlist → safe defaults so nothing breaks out-of-box: `localhost`, `127.0.0.1`,
  `*.run.app` (Cloud Run), `*.web.app`, `*.firebaseapp.com` (Firebase Hosting).
  Custom prod domains (e.g. studio.google.com) REQUIRE ops to set `ALLOWED_HOSTS`.
- Middleware: first thing in `middleware()` reads `request.headers.get("host")`; invalid →
  `400 "Invalid Host"`. Runs BEFORE any `NextResponse.redirect(new URL(..., request.url))`,
  blocking Host-header injection / open-redirect.

## Validation (all pass)
- `bun test src` → 273 pass (incl. 6 new). `bun run lint` → clean. No diagnostics.
- `NODE_ENV=production bun run build` → ✓ Compiled, `/api/health` route emitted.
- Runtime smoke (prod server): `/api/health` → 200 `{"status":"ok"}`; `/` headers verified
  (CSP prod profile, HSTS, no X-Powered-By); `Host: evil.example.com` → 400; localhost OK.

## Env contract
- `ALLOWED_HOSTS` (optional, comma-sep) — tighten prod host allowlist. Default keeps
  localhost/Cloud Run/Firebase working.
- No new secrets required.
