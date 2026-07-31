# Phase F — Deployment / Cutover Config Audit (READ-ONLY)

Scope: `infra/modules/platform`, `infra/modules/cloud-run-service`, `infra/modules/firebase-hosting-service`, `infra/modules/secret-manager`, `infra/environments/dev-infra-example/*`, `frontend-next/cloudbuild.yaml`, `frontend-next/Dockerfile`, `frontend-next/Dockerfile.dev`, `frontend-next/next.config.ts`, `frontend/cloudbuild-deploy.yaml`, `frontend/firebase.json`, `frontend-next/src/**` env-var consumers.
No Terraform/gcloud applied. No files edited.

## Inventory of Next.js deployment wiring (what exists)

- `google_artifact_registry_repository.next` → `cs-next-${env}-repo` (DOCKER).
- `google_service_account.next_run` (runtime), `google_service_account.next_trigger` (build trigger).
- `google_cloud_run_v2_service.next`: container_port 8080, placeholder `hello:latest` image (ignore_changes on image), `next_run` SA, dynamic env from `next_env_vars`, dynamic secret-key-ref env from `next_runtime_secrets`, scaling min/max.
- `google_cloud_run_v2_service_iam_member.next_public_invoker` → `allUsers` (public).
- `google_cloudbuild_trigger.next` → filename `frontend-next/cloudbuild.yaml`, subs `_REGION/_REPO_NAME/_SERVICE_NAME`, push on `^${github_branch_name}$`, `included_files=["frontend-next/**"]`.
- IAM: trigger SA gets `logging.logWriter`, `artifactregistry.writer`, `run.developer`, `iam.serviceAccountUser` on next_run. next_run SA gets `secretmanager.secretAccessor` per name in `next_runtime_secrets`.
- `frontend-next/cloudbuild.yaml`: docker build → push → `gcloud run deploy ${_SERVICE_NAME} --image=...:$SHORT_SHA --region --quiet`. Images tagged `$SHORT_SHA`.
- `frontend-next/Dockerfile`: bun deps → bun build → node:20-alpine runner; copies `.next/standalone`, `.next/static`, `public`; runs `node server.js` on `PORT=8080`. `next.config.ts` has `output:"standalone"`.
- `dev-infra-example/dev.tfvars`: `next_env_vars={BACKEND_URL, GOOGLE_CLIENT_ID, GOOGLE_HOSTED_DOMAIN, NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID}`; `next_runtime_secrets={AUTH_SESSION_SECRET}`.
- `CORS_ORIGINS` on backend includes both `frontend_url` (Firebase) and `next_frontend_url` (run.app).

## P0 BLOCKERS (blocks cutover)

### P0-1. NEXT_PUBLIC_* not available at BUILD time → client bundle ships with empty values
Next.js inlines `NEXT_PUBLIC_*` into the client bundle at `next build`. Dockerfile `build` stage runs `bun run build` with NO build-args / NO env. TF `next_env_vars` (incl. `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) are injected only as **runtime** Cloud Run env, which is too late for client-side consumers:
- `src/lib/auth/gis.ts` → `client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""` (login button).
- `src/lib/api/client.ts` → `defaultBaseUrl()` falls back to `NEXT_PUBLIC_API_BASE_URL`.
- `src/features/admin/feature-flags.ts` → `NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN` seed.
Result: GIS login renders no button, client API base resolves to `""`. Server-side fetches in RSC use `BACKEND_URL` and work; client bundle does not.
Fix direction (NOT applied): pass `_NEXT_PUBLIC_*` Cloud Build subs → `docker build --build-arg` → `ARG NEXT_PUBLIC_*` → `ENV` in Dockerfile build stage. Or read from Secret Manager into the build step env.

### P0-2. AUTH_SESSION_SECRET never created; service crashes on first session op
`google_secret_manager_secret_iam_member.next_runtime_secret_access` grants accessor IAM but TF never creates the secret resource (`google_secret_manager_secret`). `update_secrets.sh` loops only over `frontend_secrets` + `backend_secrets` TF outputs (env outputs.tf has no `next_runtime_secrets` output). `src/lib/auth/session.ts:sessionSecret()` throws when secret missing or `<32` chars → every login/CSRF path 500s.
Fix direction: bootstrap `AUTH_SESSION_SECRET` (>=32 chars) manually, or add secret-manager module call for next + extend `update_secrets.sh`.

### P0-3. No Firebase Hosting rewrite to Next → no domain cutover path
`frontend/firebase.json` only rewrites `/api/**` → backend Cloud Run + `**` → `/index.html` (Angular SPA). There is NO `frontend-next/firebase.json` and no Firebase rewrite to `google_cloud_run_v2_service.next`. Next is reachable ONLY on its raw run.app URL. Cutover from Angular (Firebase Hosting) to Next has no traffic-shift mechanism via Firebase. `frontend_custom_audiences` declared/passed but UNUSED in `platform/main.tf` (Angular is not on Cloud Run).
Fix direction: either (a) Front the Next Cloud Run service via Firebase Hosting rewrites (`run` rewrite block in a new `frontend-next/firebase.json` + site) for staged domain cutover, or (b) accept run.app-only Next URL and update DNS/IAP perimeter separately. Decision needed.

### P0-4. cloudbuild.yaml deploys with no revision/traffic controls
`gcloud run deploy --image=...:$SHORT_SHA --region --quiet` routes 100% traffic to the new revision immediately. No `--no-traffic`, no `--tag`, no traffic split. No canary. No tag-based rollback. No revision pinning. Same pattern in backend (module). Any bad deploy = full-blast production rollout with rollback requiring image re-tag/redeploy.
Fix direction: add `--no-traffic --tag=gcp-next-$SHORT_SHA` then `gcloud run services update-traffic ... --to-revisions` for staged cutover, or wire `google_cloud_run_v2_service` `traffic` block (currently absent across the repo).

## P1 BLOCKERS (high severity, not hard blockers)

### P1-1. No health/readiness/startup probe anywhere
Grep for `traffic|startup_probe|liveness_probe|timeout|concurrency|cpu_boost|ingress` across `infra/**/*.tf` → 0 matches. Cloud Run v2 falls back to default container-port probe. `next_scaling_min_instances` defaults to 0 (dev.tfvars does not override) → cold starts; with no startup_probe the first request after scale-from-zero may 503 before Next boots. No `/health` or `/api/health` route exists in `frontend-next/app`. Backend likewise lacks explicit probe.
Fix direction: add Next `app/api/health/route.ts` returning 200, set `startup_probe` + `liveness_probe` on both Cloud Run services, set `min_instance_count>=1` for prod.

### P1-2. No request `timeout`, `concurrency`, or `cpu_boost` configured
Defaults: timeout 300s, concurrency 100, no CPU boost. Next SSR at 512Mi / 1000m with 100 concurrent requests is a memory-saturation risk (dev.tfvars uses module defaults `next_cpu=1000m`, `next_memory=512Mi`). Long-running BFF calls to workflows/video may exceed implicit client timeouts even if Cloud Run allows 300s.
Fix direction: explicit `template.timeout`, `template.concurrency`, `volumes/containers.resources`, evaluate `cpu_boost=true`.

### P1-3. CORS surface mismatch under cutover
Backend `CORS_ORIGINS` includes `frontend_url` (Firebase `*.web.app`) + `next_frontend_url` (run.app). If Next is later fronted via Firebase Hosting on a custom/apex domain or via the Angular site domain, browser-side client fetches to backend will be cross-origin and rejected. BFF server-side calls bypass CORS, but any client-direct API path will break.
Fix direction: revisit CORS list once cutover domain is fixed; prefer server-only BFF to drop client CORS surface.

### P1-4. Public ingress + no IAP / auth perimeter on Next service
`next_public_invoker` grants `roles/run.invoker` to `allUsers`. Next service is reachable on run.app without perimeter. `gcp_auth` memory notes optional IAP perimeter. Not enforced. Login gate is app-level only.
Fix direction: restrict ingress (`internal-and-cloud-load-balancing`) + IAP for org-only deployments, or accept public with app-layer auth.

### P1-5. Image tag = `$SHORT_SHA` only; no semver/immutable pin in TF
Cloud Run TF hardcodes `hello:latest` + `lifecycle.ignore_changes=[image]`; image actually deployed is `:$SHORT_SHA`. Traceable but not semver; no `latest` alias for easy reference. Backend uses identical pattern. Acceptable but no release-tag mapping.
Fix direction: tag images with `$SHORT_SHA` + git tag (e.g., `:$COMMIT_SHA-:vX.Y.Z`) and record in release notes.

### P1-6. `custom_audiences` on Next service has no consumer
`next_custom_audiences` wired into `google_cloud_run_v2_service.next` but Next never validates incoming backend ID tokens (no token-verification middleware on inbound requests — only Google credential verification in `verify.ts`). Audience list is dead config until backend-to-next service assertion auth is implemented (per `gcp_auth` memory step 6).

## Disjoint implementation WRITE SETS (who must change what, isolated)

| Write set | Files / resources | Owner lane |
|---|---|---|
| WS-A Build-time NEXT_PUBLIC injection | `frontend-next/Dockerfile` (build-args/ARG/ENV), `frontend-next/cloudbuild.yaml` (--build-arg, subs), `infra/modules/platform/main.tf` (`google_cloudbuild_trigger.next` substitutions) | Frontend build + Infra |
| WS-B Session secret bootstrap | `infra/modules/platform/main.tf` (add `module "next_secrets"` secret-manager call OR pre-bootstrap step), `infra/environments/dev-infra-example/outputs.tf` (expose next_runtime_secrets), `infra/environments/dev-infra-example/update_secrets.sh` (extend loop) | Infra |
| WS-C Firebase rewrite / domain cutover | NEW `frontend-next/firebase.json` (or extend `frontend/firebase.json` with second hosting site), `infra/modules/platform/main.tf` (firebase-hosting-service module for next OR run rewrite block), DNS/IAP decision | Infra + Frontend |
| WS-D Revision/traffic/canary/rollback | `frontend-next/cloudbuild.yaml` (deploy/traffic steps), `backend/cloudbuild.yaml` (same), optional `google_cloud_run_v2_service.*.traffic` TF blocks | Infra |
| WS-E Health probes + timeouts + concurrency | `frontend-next/app/api/health/route.ts` (new), `infra/modules/cloud-run-service/main.tf` (probe/timeout/concurrency), `infra/modules/platform/main.tf` (same for next inline block), `next_scaling_min_instances` prod override | Frontend + Infra |
| WS-F CORS / ingress / IAP perimeter | `infra/modules/platform/main.tf` (`CORS_ORIGINS` local, `google_cloud_run_v2_service.next.ingress`, optional IAP resources) | Infra |
| WS-G Dead-config cleanup | `infra/modules/platform/variables.tf` + `main.tf` (`frontend_custom_audiences` unused), `infra/modules/platform/main.tf` (`next_custom_audiences` until backend assertion auth ships) | Infra |

## Cross-cutting notes
- Backend module is reused unchanged (Cloud SQL volume mount, DB_PASS secret env). Next module is INLINE in platform/main.tf, not factored into `cloud-run-service` module → divergence in maintenance (no probe/timeout/concurrency plumbing for next while backend module also lacks them).
- `deletion_protection = false` on both services → easier destroy but no accidental-delete guardrail.
- Dockerfile uses non-root `next` uid 1001 + `output: standalone`; good. No `HEALTHCHECK` instruction (Cloud Run ignores Dockerfile HEALTHCHECK anyway — needs Cloud Run probe).
- `cloudbuild.yaml` substitutions block hardcodes `_REGION=us-central1`, `_REPO_NAME=cs-next-development-repo`, `_SERVICE_NAME=creative-studio-next` as defaults; TF trigger overrides all three via subs. Safe but brittle if trigger subs drift.
- `Dockerfile.dev` exposes 3000 + bun dev; not used by Cloud Run. Local-only.

## Status
Phase F audit complete. READ-ONLY. No Terraform/gcloud executed, no files modified. Hand-off: resolve P0-1..P0-4 before any production cutover attempt.
