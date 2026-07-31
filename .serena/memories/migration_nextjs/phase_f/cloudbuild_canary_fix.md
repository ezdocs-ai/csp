# Phase F — frontend-next Cloud Build canary pipeline (IMPLEMENTED)

Date: 2026-07-29
Mode: WRITE. Files edited: `frontend-next/Dockerfile`, `frontend-next/cloudbuild.yaml`.
NOT touched: any Terraform (`infra/**`), `frontend-next/.dockerignore`, `frontend-next/package.json`, root `.dockerignore`. No gcloud run.

Resolves P0-1, P0-4, B1, B4, H1, M1 from `mem:migration_nextjs/phase_f/deployment_audit` and `mem:migration_nextjs/phase_f/ci_security_audit` (WS-A + WS-D build/deploy lanes only — infra lanes WS-B/C/E/F/G left to Infra).

## What changed

### `frontend-next/Dockerfile`
- Bun pinned: `oven/bun:1-alpine` -> `oven/bun:1.2.19-alpine` in BOTH `deps` and `build` stages (fixes H1 drift vs CI's setup-bun 1.2.19).
- `build` stage now declares `ARG` + `ENV` for the four NEXT_PUBLIC_* vars BEFORE `bun run build`, so Next.js inlines them into the client bundle (fixes P0-1).
- Runner stage (`node:20-alpine`) UNCHANGED: standalone copy, non-root `next` uid 1001, `node server.js` on PORT 8080 preserved.
- Consumed names (verified in source):
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — `src/lib/auth/gis.ts` (GIS login button client_id).
  - `NEXT_PUBLIC_API_BASE_URL` — `src/lib/api/client.ts` (`defaultBaseUrl()` fallback).
  - `NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN` — `src/features/admin/feature-flags.ts` (`seed()`, accepts `"true"`/`"1"`).
  - `NEXT_PUBLIC_APP_URL` — canonical app origin (no direct consumer grep hit yet; carried for middleware/redirect base).

### `frontend-next/cloudbuild.yaml` (full rewrite)
Two-mode pipeline keyed on `_PROMOTE`:

1. `Verify` (skip if promote) — `bun install --frozen-lockfile`; `gen-api` ONLY if `openapi.json` exists (`bun scripts/gen-api.ts` called directly, sidesteps broken `package.json` `gen:api` cwd bug M4); `bun run lint`; `bun run test` (= `bun test src`); `bun run build` with NEXT_PUBLIC_* exported. Required-var guard aborts if `_NEXT_PUBLIC_GOOGLE_CLIENT_ID/_NEXT_PUBLIC_APP_URL/_NEXT_PUBLIC_API_BASE_URL` empty. gen-api output (`src/lib/api/types.ts`) lands on the shared /workspace and is picked up by the Docker build context (fixes B1).
2. `Build` (skip if promote) — `docker build` with `-t :$SHORT_SHA -t :latest` + four `--build-arg=NEXT_PUBLIC_*`. Context = `frontend-next` (isolated; effective `.dockerignore` = `frontend-next/.dockerignore`, which already excludes node_modules/.next/openapi.json/tests).
3. `PushSha` (skip if promote) — push immutable SHA tag.
4. `PushLatest` (skip if promote) — push `:latest` only when `_PUSH_LATEST=true`.
5. `Deploy` (skip if promote) — `gcloud run deploy ... --no-traffic --tag=rev-$SHORT_SHA --update-env-vars=... --update-secrets=AUTH_SESSION_SECRET=${_AUTH_SECRET_NAME}:latest`. Creates a tagged zero-traffic revision (canary). Uses `--update-*` (merge) NOT `--set-*` to avoid wiping TF-managed server-side vars (`GOOGLE_CLIENT_ID`, `GOOGLE_HOSTED_DOMAIN`, `BACKEND_URL`) in the deployed revision.
6. `Promote` (run ONLY if `_PROMOTE=true`) — `gcloud run services update-traffic --to-tags=rev-$SHORT_SHA=100`. Never runs by default -> promotion is a separate, explicit invocation (fixes P0-4 / B4 / M1).

Substitutions: `_REGION`, `_REPO_NAME`, `_SERVICE_NAME`, `_AUTH_SECRET_NAME=auth-session-secret`, `_PUSH_LATEST=true`, `_PROMOTE=false`, four `_NEXT_PUBLIC_*` (default empty / `false`).

## Canary usage
- Build+deploy new revision (no traffic): normal trigger (or `gcloud builds submit --substitutions=_NEXT_PUBLIC_*=...`). Revision `rev-<SHA>` gets 0% traffic.
- Smoke-test the zero-traffic tag URL, then promote:
  `gcloud builds submit --config frontend-next/cloudbuild.yaml --substitutions=_PROMOTE=true ...` (only `Promote` does work; all other steps self-skip).

## Deliberate non-changes (decisions, not gaps)
- `.dockerignore` (root) left UNTOUCHED: shared by other services (backend/frontend Angular) whose builds may use repo-root context; rewriting it to be frontend-next-aware would risk those. For this pipeline the build context is `frontend-next`, so the EFFECTIVE ignore is `frontend-next/.dockerignore` (out of my stated scope) which is already adequate (excludes node_modules/.next/.git/openapi.json/tests). No safe/beneficial edit to either ignore file was needed.
- `package.json` `gen:api` left as-is: cloudbuild calls `bun scripts/gen-api.ts` directly (same workaround CI uses), so the broken cwd was not in the path. Fixing it is cosmetic and outside the stated scope.
- Server-side non-public runtime vars (`GOOGLE_CLIENT_ID`, `GOOGLE_HOSTED_DOMAIN`, `BACKEND_URL`) NOT set by cloudbuild: Terraform `google_cloud_run_v2_service.next` template `next_env_vars` already injects them. cloudbuild uses `--update-env-vars` only for the public set + NODE_ENV so it does not clobber them.

## Cross-cutting risks (flag, do NOT fix here — Infra/TF lane)
- TF drift: `google_cloud_run_v2_service.next` manages env_vars/secrets in template. cloudbuild `--update-env-vars`/`--update-secrets` mutate the same; if cloudbuild values ever diverge from TF `next_env_vars`/`next_runtime_secrets`, the next `terraform apply` reconciles back. Currently drift-neutral because the public vars + AUTH_SESSION_SECRET match the TF-managed set. Reconcile ownership (cloudbuild-vs-TF) in Infra lane if desired.
- AUTH_SESSION_SECRET must EXIST in Secret Manager before `Deploy` runs (P0-2 not fixed — TF grants accessor IAM but never creates the secret resource; `update_secrets.sh` does not cover next). `_AUTH_SECRET_NAME` defaults to `auth-session-secret`. Bootstrap >=32-char secret manually or via secret-manager TF module first, else Deploy fails on `--update-secrets`.
- Health probes / timeout / concurrency / ingress (P1-1/2/4) still unconfigured — Infra lane (WS-E/WS-F).
- Image is referenced `:$SHORT_SHA` (immutable); TF service hardcodes `hello:latest` + `ignore_changes=[image]`, so the running image is whatever cloudbuild deployed. Tag-based rollback = `update-traffic --to-tags=rev-<oldSHA>=100`.

## Validation NOT run
No `gcloud`, no `docker build`, no deploy executed (per constraints). Logic verified by static review against the two Phase F audits. Local dry-run of `docker build` with the build-args + a `gcloud builds submit --dry-run` are the recommended next checks (operator side).
