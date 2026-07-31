# Phase F — Next.js Terraform Cutover Fix

Scope: Terraform config ONLY. NEVER `terraform apply` / `gcloud` / `firebase deploy`. Validated offline (backend.tf moved aside, `terraform init -backend=false` + `terraform validate` → Success). `terraform fmt -recursive` run on platform module + env.

## Files changed
- `infra/modules/platform/main.tf` — Next service (probes/concurrency/timeout/cpu-boost/traffic), secret shell + accessor, CORS extra origins.
- `infra/modules/platform/variables.tf` — new vars.
- `infra/modules/platform/outputs.tf` — next canary/secret outputs.
- `infra/environments/dev-infra-example/{variables,main,outputs}.tf` — passthrough + mirror outputs.
- `infra/environments/dev-infra-example/dev.tfvars` — safe example values.
- `infra/environments/dev-infra-example/update_secrets.sh` — now also lists Next runtime secrets for manual population.

## Key decisions
- **AUTH_SESSION_SECRET**: Terraform now OWNS the secret shell (metadata only, `google_secret_manager_secret.next_runtime`, replication auto, NO version/value). Accessor IAM grants Next runtime SA (`next_run`). Output `next_secrets_to_populate` lists IDs; `update_secrets.sh` merged Next secrets into its prompt loop. Value must be populated manually out-of-band.
- **Probes**: `startup_probe` (period/timeout 240s, failure_threshold 1) + `liveness_probe` (period 60s, timeout 10s, failure 3), both `http_get /api/health` port 8080. google provider 7.41.0 schema confirmed `startup_probe`/`liveness_probe` + `http_get{path,port}` exist on v2 containers.
- **Concurrency/timeout**: `template.max_instance_request_concurrency` (= var.next_concurrency, default 100) and `template.timeout` (= "${var.next_timeout_seconds}s", default 300). Schema field name is `max_instance_request_concurrency` (NOT max_concurrency).
- **Startup CPU boost**: NO `startup_cpu_boost` field exists in v2 template attrs for provider 7.41.0. Implemented via `template.annotations["run.googleapis.com/enable-cpu-boost"]` gated by `var.next_startup_cpu_boost` (default true).
- **Traffic/canary**: `next_manage_traffic` (bool, default true) + `next_traffic_splits` (list(object{type,revision,percent,tag}), default []). Default => 100% TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST (safe). When `next_manage_traffic=false`, `traffic` dynamic block is omitted entirely so Terraform does NOT touch traffic — operator can use `gcloud run deploy --no-traffic` canary. Canary revisions surfaced via outputs `next_service_name`, `next_service_location`, `next_latest_ready_revision`.
- **CORS**: backend `CORS_ORIGINS` now `jsonencode(distinct(concat([firebase_url, next_url], var.be_cors_extra_origins)))`. Added `be_cors_extra_origins` (list, default []) through all layers.
- **Image drift**: kept `ignore_changes = [template[0].containers[0].image, client, client_version]` so Cloud Build owns the image.

## Out of scope (unchanged)
- No DNS / IAP changes.
- `cloud-run-service` module (backend): reverted fmt-only changes; no functional edits (backend probes not requested).
- firebase-hosting-service, postgresql: reverted fmt-only drift.

## Manual follow-up (operator)
1. Populate `AUTH_SESSION_SECRET` value in Secret Manager (run `update_secrets.sh`, or `gcloud secrets versions add AUTH_SESSION_SECRET --data-file=-`).
2. Canary: deploy `gcloud run deploy ... --no-traffic`, set `next_manage_traffic=false` (or set explicit `next_traffic_splits`), then `terraform apply`.
3. Backend CORS custom origins: set `be_cors_extra_origins` in tfvars.

## Pre-existing note
env `main.tf` already passed `next_cpu`/`next_memory` to the platform module and env `variables.tf` already declared them — no gap. (Initial misread corrected.)
