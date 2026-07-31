# Phase F — Remove Firebase from Next.js: FINAL READ-ONLY REVIEW

**Date:** 2026-07-29
**Scope:** Verify csp/frontend-next has no Firebase runtime/deploy integration or permissive Firebase host defaults, Cloud Run standalone deploy intact, Google GIS auth intact, Angular Firebase files untouched. READ-ONLY — no edits made.

## Verdict: PASS — NO BLOCKERS

## 1. Firebase runtime/deploy integration in frontend-next → NONE
- No `firebase.json` / `.firebaserc` / `firebaseappdistribution` / `firebase-admin` / `firebase` SDK in csp/frontend-next (find_path: no matches).
- `package.json` deps: `google-auth-library`, `jose`, `next`, `react`, `react-dom`. No Firebase package.
- No source imports of `firebase`, `firestore`, `signInWith*`, `getAuth(`, `initializeApp` in `src/**/*.ts(x)`.
- Only "firestore" occurrence = harmless generated string in `src/lib/api/types.ts` (copied from backend OpenAPI brand-guidelines endpoint description). Not runtime integration.
- `bun.lock` matches = false-positive transitive deps (es-abstract, has-tostringtag, etc.), not Firebase.

## 2. Permissive Firebase host defaults → NONE
- No Firebase Hosting config exists in frontend-next, so no permissive host defaults.
- Host security enforced: `src/middleware.ts` → `isAllowedHost(host, parseAllowedHosts(ALLOWED_HOSTS))`, rejects invalid Host with 400.
- `next.config.ts`: strict CSP (`buildContentSecurityPolicy`), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS in prod, `poweredByHeader: false`, `output: standalone`.

## 3. Cloud Run standalone deployment → INTACT
- `cloudbuild.yaml`: `gcloud run deploy creative-studio-next` from Artifact Registry image (`${_REGION}-docker.pkg.dev/.../creative-studio-next:$SHORT_SHA`).
  - Canary model: `--no-traffic --tag=rev-$SHORT_SHA`, manual promote via `_PROMOTE=true` + `_PROMOTE_TAG`.
  - Runtime env: `--update-env-vars=NODE_ENV=production`; secret `AUTH_SESSION_SECRET` via `--update-secrets`.
  - NO Firebase Hosting / `firebase deploy` anywhere.
- `Dockerfile`: multi-stage, standalone Next.js, non-root `next:1001`, `PORT=8080`, `CMD ["node","server.js"]`.

## 4. Google GIS auth → INTACT
- `src/lib/auth/gis.ts`: `GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client"`, `client_id` from `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `use_fedcm_for_prompt: true`.
- `src/middleware.ts` + `src/lib/auth/session.ts` (`verifySession`) use `jose` for JWT/session cookie verification (`SESSION_COOKIE`).
- `google-auth-library` present for server-side token exchange/verify (`src/lib/auth/server.ts`, `verify.ts`).

## 5. Angular Firebase files NOT modified by this task → CONFIRMED
- `csp/frontend/.firebaserc` and `csp/frontend/firebase.json` → NOT in `git status` (neither modified nor untracked).
- `git diff --stat HEAD -- frontend/.firebaserc frontend/firebase.json` → empty.
- All `frontend/src` changes are unrelated (admin-layout, admin-routing, admin.module, flow-prompt-box, model-config, video-state.service, video.component) — Firebase hosting/SDK files untouched.

## Notes / Caveats
- `csp/frontend-next/` is NOT git-tracked at all (`git ls-files frontend-next/` = 0 files; appears under Untracked). Therefore git diff cannot evidence the Firebase removal itself — this review is source-state based. Recommend committing frontend-next to git so future audits have a diff trail.
- This review did NOT run build/tests (read-only task). Prior phases should have verified `bun run lint`/`test`/`build` green.

## Blockers: NONE
