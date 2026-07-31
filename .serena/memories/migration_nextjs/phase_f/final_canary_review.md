# Phase F — Final READ-ONLY Canary Review (Dockerfile, cloudbuild.yaml, firebase.json, .firebaserc, firebase-canary.ts)

Date: 2026-07-29. Mode: READ-ONLY. NO edits, NO gcloud/firebase, NO deploy, NO md files created. Docs consulted via Context7: Firebase Hosting (`/websites/firebase_google` run-rewrite + multisites + deploy-only), Cloud Run (`/websites/cloud_google_sdk` traffic flags GA), Next.js (`/vercel/next.js` NEXT_PUBLIC frozen at build + standalone). Bun via verified knowledge (bun.lock text + `--frozen-lockfile` supported in 1.2.x; context7 query budget spent).

Scope cross-checked vs `infra/modules/platform/main.tf` (`google_cloudbuild_trigger.next` L321-341), `frontend-next/.dockerignore`, git tracking of generated API files, and prior mems `phase_f/deployment_audit`, `phase_f/cloudbuild_canary_fix`, `phase_f/firebase_canary_fix`, `phase_f/ci_security_audit`, `phase_f/next_security_fix`.

## VERIFIED CORRECT (no-traffic/promotion core is sound)
- Cloud Run canary flags all GA (docs): `--no-traffic --tag=rev-$SHORT_SHA` deploys 0%-traffic tagged rev; `update-traffic --to-tags=rev-$SHORT_SHA=100` promotes. Pipeline `Deploy` + `Promote` steps use exactly this. Correct.
- Two-mode `_PROMOTE` switch logic correct: promote-only run self-skips Verify/Build/Push/PushLatest/Deploy; non-promote run self-skips Promote. Promotion never automatic (P0-4 resolved on the cloudbuild side).
- Next.js NEXT_PUBLIC_* are inlined+ frozen at `next build` (docs). Dockerfile `build` stage declares `ARG`+`ENV` for the 4 NEXT_PUBLIC_* BEFORE `bun run build`; cloudbuild passes matching `--build-arg`. Correct pattern (runtime Cloud Run env is too late for client bundle — cloudbuild Verify comment states this accurately).
- Bun pinning consistent: `oven/bun:1.2.19-alpine` in deps + build (matches CI setup-bun 1.2.19; fixes prior H1 drift). `bun.lock` is text format (1.2); Dockerfile `COPY package.json bun.lock` matches; `--frozen-lockfile` valid in 1.2.19.
- Standalone runner correct: `output:"standalone"` (next.config.ts) + `node:20-alpine`, non-root uid 1001, copies `.next/standalone`/`.next/static`/`public`, `node server.js` PORT 8080. Standard.
- Firebase Hosting `run` rewrite syntax matches docs: `serviceId` (service name) + `region` (optional, default us-central1) + optional `pinTag`. `firebase.json` uses serviceId+region (no pinTag — deliberate, see P1-1).
- `--update-env-vars` (merge) NOT `--set-env-vars` — preserves TF-managed server-side vars (`GOOGLE_CLIENT_ID`, `GOOGLE_HOSTED_DOMAIN`, `BACKEND_URL`). Correct intent.
- `firebase-canary.ts` validate/resolve is no-deploy/no-network (fs only); serviceId regex + region allowlist enforced post-resolve; BFF `/api/**`→Next invariant checked. Solid.

## P0 BLOCKERS (block canary build/deploy)

### P0-1. Trigger omits required NEXT_PUBLIC_* substitutions → EVERY push-triggered build aborts at Verify
- TF `google_cloudbuild_trigger.next` substitutions = ONLY `_REGION`, `_REPO_NAME`, `_SERVICE_NAME` (main.tf L327-330). push on `^${github_branch_name}$`, `included_files=["frontend-next/**"]`.
- `_NEXT_PUBLIC_GOOGLE_CLIENT_ID/_APP_URL/_API_BASE_URL` default to `""` (cloudbuild.yaml L147-149). Verify guard (L49-51) `if [ -z $GCID ] || [ -z $APP_URL ] || [ -z $API_BASE ]; exit 1` → ALWAYS aborts on trigger.
- Net: wired auto-build-on-push is dead; only manual `gcloud builds submit --substitutions=_NEXT_PUBLIC_GOOGLE_CLIENT_ID=..,_NEXT_PUBLIC_APP_URL=..,_NEXT_PUBLIC_API_BASE_URL=..` works.
- Fix (Infra/WS-A): inject `_NEXT_PUBLIC_*` via trigger subs (from Secret Manager build-secret binding or TF vars) OR have Verify fetch them from Secret Manager. Not in cloudbuild.yaml scope alone — needs trigger-side change.

### P0-2. Generated-API gate is broken → docker `next build` fails (B1 NOT actually fixed)
- `frontend-next/openapi.json` AND `frontend-next/src/lib/api/types.ts` are UNTRACKED (git ls-files = 0; NOT gitignored; exist on disk only).
- Verify gate (L53) `if [ -f openapi.json ]; then gen-api; else skip` → in clean Cloud Build checkout openapi.json absent → skip → types.ts never generated.
- `types.ts` is a HARD dep: imported by `src/components/media/media-card.tsx`, `src/features/gallery/types.ts`, `src/features/gallery/gallery-utils.ts`. No `typescript.ignoreBuildErrors` in tsconfig/next.config → `next build` typechecks → FAIL.
- `frontend-next/.dockerignore` ALSO excludes `openapi.json` → docker build cannot regenerate it even if present in repo.
- Prior mem `phase_f/cloudbuild_canary_fix` claimed B1 fixed via gen-api step — INCORRECT (assumed openapi.json present in checkout).
- Fix: (a) commit `openapi.json` as source-of-truth (+ regenerate+commit types.ts), OR (b) fetch openapi.json from backend in Verify before gen-api, OR (c) if types.ts is the artifact, commit it and drop the `if [ -f ]` silent-skip. Silent-skip gate is the root hazard (fails open).

### P0-3. AUTH_SESSION_SECRET never created in Secret Manager → Deploy fails (still open, prior P0-2)
- Deploy step (L122): `--update-secrets=AUTH_SESSION_SECRET=${_AUTH_SECRET_NAME}:latest`. TF grants accessor IAM but never creates the secret resource; `update_secrets.sh` loop excludes next. `_AUTH_SECRET_NAME` defaults `auth-session-secret`.
- First Deploy fails on missing secret (or first login 500s via `session.ts` >=32-char guard).
- Fix (Infra/WS-B): bootstrap secret (>=32 chars) in SM, or add secret-manager TF module for next, before any Deploy.

## P1 (high — correctness/operational)

### P1-1. Firebase Hosting rewrite has NO pinTag → canary site serves LIVE traffic, not the no-traffic tagged revision
- Cloud Run `--no-traffic --tag=rev-$SHA` makes new rev reachable ONLY via raw `rev-$SHA.run.app` tag URL (0% live traffic).
- firebase.json run rewrite WITHOUT `pinTag` (docs: optional `pinTag:true` pins rewrite to a tagged rev) routes Hosting to the service's CURRENT live traffic allocation → serves the OLD revision until Promote.
- Consequence: cannot smoke the new rev via the Firebase canary DOMAIN pre-promote; canary only testable via raw Cloud Run tag URL. If tag-URL smoke is the intended path this is acceptable; for domain-level revision canary add `"pinTag": true` to the `/api/**` + `**` rewrites (requires rev tag to exist first: deploy rev → resolve+deploy Hosting with pinTag → Hosting pinned to that tag).

### P1-2. Promote uses implicit $SHORT_SHA → promote-only run from a different commit references a non-existent tag
- `Promote` (L134-137): `update-traffic --to-tags=rev-$SHORT_SHA=100`. `$SHORT_SHA` is Cloud Build-implicit (the build's own commit), NOT an overridable substitution.
- A promote-only build triggered by/submitted from a NEWER commit than the deployed one → `rev-<newSHA>` tag does not exist → `update-traffic` fails.
- Promotion MUST run at the SAME commit that was deployed, OR `_SHORT_SHA`/a `_TAG` should become an explicit overridable substitution. Add explicit `_PROMOTE_TAG` (default `rev-$SHORT_SHA`) to make promote target-controllable.

### P1-3. NEXT_PUBLIC_* in `--update-env-vars` is redundant + creates TF-drift
- Next.js freezes NEXT_PUBLIC_* at build (docs) → runtime env has zero effect on client bundle (already inlined). Cosmetic only; harmless for client.
- TF `next_env_vars` ALSO manages `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_GOOGLE_CLIENT_ID` → two owners of same keys → next `terraform apply` reconciles to TF values, overwriting cloudbuild's. Drift-neutral only while values match.
- Recommendation: drop NEXT_PUBLIC_* from `--update-env-vars` (keep NODE_ENV only); leave server-side + public vars TF-owned; resolve cloudbuild-vs-TF ownership in Infra lane.

## P2 (medium/minor)
- P2-1. `NEXT_PUBLIC_APP_URL` has NO consumer in `src/` (grep 0 hits). Passed as build-arg + runtime env but unused. Harmless; remove if dead or wire to middleware/redirect base.
- P2-2. `_PUSH_LATEST="true"` default pushes `:latest` every build; TF service hardcodes `hello:latest` + `ignore_changes=[image]` → informational only, harmless.
- P2-3. `firebase.json` uses `"site"` (valid firebase.json key — directly references Hosting site resource ID, no `.firebaserc` target mapping needed; canonical multisites docs show `target` but `site` is equivalent+supported). Deploy isolation relies on invoking `firebase deploy --only hosting` against the RESOLVED single-entry config in `.firebase-canary/`. Confirm the dedicated canary site (`creative-studio-next-canary`) is CREATED in the Firebase project before first deploy (infra step, not done).
- P2-4. `firebase-canary.ts` `canaryEntry()` falls back to `entries[0]` when no site token/"next"/"canary" match — fine for the current single-object template; ambiguous for a future multi-entry template. Low.

## Open (infra lane, not code-review-fixable here)
- Firebase Hosting canary site not yet created; TF has no `firebase-hosting-service` module call for next (WS-C open). `.firebaserc` resolves project id only.
- Health probes / timeout / concurrency / min-instances / ingress / IAP (P1 from deployment_audit) unconfigured. cloudbuild `gcloud run deploy` adds none.
- CORS surface under cutover (P1-3 audit) open.

## Bottom line
Canary PIPELINE mechanics (no-traffic tag → explicit 100% promote; build-time NEXT_PUBLIC injection; standalone Docker; Hosting run-rewrite shape) are correctly DESIGNED and docs-consistent. But the chain is NOT runnable end-to-end today: P0-1 (trigger missing subs) + P0-2 (generated-API silent-skip) break every automated build; P0-3 (missing secret) breaks Deploy. Resolve P0-1/2/3 before any canary attempt; address P1-1/2/3 for true revision-canary + safe promotion.