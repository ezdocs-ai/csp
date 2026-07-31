# Phase F — Firebase Hosting canary config for Next (WS-C / P0-3) IMPLEMENTED

Written 2026-07-29. Created canary Firebase Hosting config + validate/resolve scripts under `frontend-next/`. NO deploy, NO gcloud/firebase CLI, NO cloud resource changes. `frontend/firebase.json` (Angular prod) UNTOUCHED.

## Why isolated in frontend-next/ (not frontend/firebase.json)
`frontend/firebase.json` is the Angular prod template: `/api/**`→backend Cloud Run + `**`→`/index.html`. Adding a second canary hosting block there would alter the prod file structure and risk the SPA rewrites. Per task guard ("only if non-default opt-in can be added WITHOUT changing prod rewrites"), chose isolation: new dedicated `frontend-next/firebase.json` + `.firebaserc`. Angular prod = zero diff. Closes P0-3 / write-set WS-C from `mem:migration_nextjs/phase_f/deployment_audit` (option a: front Next Cloud Run via a dedicated Hosting site + `run` rewrite).

## Files created (3 + 1 gitignore line)
1. `frontend-next/firebase.json` — TEMPLATE, single `hosting` object (dedicated canary site), `run` rewrites → Next Cloud Run.
2. `frontend-next/.firebaserc` — TEMPLATE, `projects.default` placeholder only (mirrors `frontend/.firebaserc`).
3. `frontend-next/scripts/firebase-canary.ts` — bun, NO deploy/NO network. `validate` (default) + `resolve`.
4. `frontend-next/.gitignore` — added `/.firebase-canary/` (resolved output, never committed/deployed from repo).

## Config design (verified against Firebase Hosting docs via context7 /websites/firebase_google)
- `hosting.site`: dedicated canary site id (token `NEXT_CANARY_SITE_ID_PLACEHOLDER`). Opt-in: deploy only this site, prod Angular site untouched.
- `public`: `"public"` (dir exists in frontend-next; deploy requires a public dir).
- `rewrites` (order matters — `/api/**` first):
  - `/api/**` → `{run:{serviceId, region}}` Next. **BFF owns auth**: in canary `/api/**` routes to Next (Next issues/signs `csp_session` in `app/api/auth/*`), NOT directly to backend. DIFFERS from Angular `frontend/firebase.json` which routes `/api/**`→backend. Next then calls backend server-side via `BACKEND_URL` (bypasses CORS).
  - `**` → Next (Next serves SSR + own static from container).
- `headers`: `/api/**` → `Cache-Control: no-store, no-cache, must-revalidate` (auth/session safety; mirrors Angular block).
- `run.region` included as token (Firebase default is us-central1; token allows other regions).

## Parameterization (Firebase `firebase.json` has NO native env-var interpolation — confirmed via docs)
Tokens follow repo convention (`*_PLACEHOLDER`, same as `frontend/firebase.json` `BACKEND_SERVICE_ID_PLACEHOLDER`):
- `NEXT_SERVICE_ID_PLACEHOLDER`, `NEXT_REGION_PLACEHOLDER`, `NEXT_CANARY_SITE_ID_PLACEHOLDER`, `PROJECT_ID_PLACEHOLDER`.
- `bun scripts/firebase-canary.ts resolve` reads env `NEXT_SERVICE_ID` / `NEXT_REGION`(default us-central1) / `NEXT_CANARY_SITE_ID` / `FIREBASE_PROJECT_ID`, substitutes tokens, writes resolved `firebase.json`+`.firebaserc` to `--out` (default `.firebase-canary/`), then validates. Region/serviceId format-checked (serviceId `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`, region in Cloud Run allowlist).
- Defaults for this repo (from `frontend-next/cloudbuild.yaml` + `frontend/.firebaserc`): service `creative-studio-next`, region `us-central1`, project `creative-studio-arena`, canary site `creative-studio-next-canary`.

## Validation (bun, structural + invariant, no deploy/network)
`bun scripts/firebase-canary.ts validate [--dir DIR]` (DIR default frontend-next root = the template). Checks:
- `firebase.json`/`.firebaserc` valid JSON.
- `hosting` present; canary entry has `site` + `public`.
- ≥1 rewrite; `/api/**` rewrite present + every rewrite has `run.serviceId` + `run.region`. (HARD invariant: BFF owns `/api` auth.)
- `/api/**` no-store header present (WARN).
- If tokens unresolved → INFO "run resolve before deploy" (PASS — template is valid). If resolved → serviceId regex + region allowlist (FAIL on bad).
Exit 0/1. Verified: template PASS; resolved PASS; negative (missing `/api/**` + region `mars-1`) FAIL exit 1.

## Status / hand-off
- Config + scripts DONE and lint-clean (`bunx eslint` exit 0, diagnostics clean). No deploy performed (task hard constraint).
- Deploy (NOT done here, owner's call) would be: create the dedicated Hosting site `creative-studio-next-canary` in project `creative-studio-arena`, `resolve`, then `firebase deploy --only hosting --config .firebase-canary/firebase.json --public <dir>`. This creates/changes cloud resources — out of scope for this task; flagged for infra lane.
- Still-open Phase F items (NOT addressed, out of scope): P0-1 build-time NEXT_PUBLIC injection, P0-2 AUTH_SESSION_SECRET bootstrap, P0-4 revision/traffic/canary/rollback (`cloudbuild.yaml`), P1 probes/timeouts, CORS under cutover (see `mem:migration_nextjs/phase_f/deployment_audit`).
- Optional: Firebase `run.pinTag:true` (docs) could pin Hosting rewrite to a tagged Cloud Run revision for revision-level canary once traffic-split tags exist — left OUT to avoid requiring an unconfigured tagged revision.
