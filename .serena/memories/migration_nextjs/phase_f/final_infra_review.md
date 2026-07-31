# Phase F — Final Infra Review (Terraform / Cloud Run / Secret Manager)

READ-ONLY review. No files edited, no gcloud/terraform run. Scope:
- csp/infra/modules/platform/{main,variables,outputs}.tf
- csp/infra/environments/dev-infra-example/{main,dev.tfvars,variables.tf,update_secrets.sh}
- csp/frontend-next/cloudbuild.yaml

Docs consulted (Context7): hashicorp/terraform-provider-google (r/cloud_run_v2_service),
websites/cloud_google_sdk (gcloud run flags, GA release notes 332.0.0).

---

## BLOCKERS (must fix before prod-style rollout)

### B1. AUTH_SESSION_SECRET secret-ID mismatch (TF vs Cloud Build)
- TF `dev.tfvars`: `next_runtime_secrets = { AUTH_SESSION_SECRET = "AUTH_SESSION_SECRET" }`
  → creates Secret Manager shell `AUTH_SESSION_SECRET`, binds env var AUTH_SESSION_SECRET
  → secret `AUTH_SESSION_SECRET:latest` (main.tf L277-288, L370-380).
- Cloud Build `cloudbuild.yaml` L122: `--update-secrets=AUTH_SESSION_SECRET=${_AUTH_SECRET_NAME}:latest`
  with `_AUTH_SECRET_NAME: auth-session-secret` (L143).
- Result: two different secret IDs. TF shell `auth-session-secret` does NOT exist; CB deploy
  binds to `auth-session-secret` which TF never provisioned → either CB deploy fails or two
  divergent secrets exist and ownership flips each deploy/apply.
- Fix (pick ONE, apply to both sides):
  (a) dev.tfvars: `AUTH_SESSION_SECRET = "auth-session-secret"`  [RECOMMENDED, follows env naming]
      + keep cloudbuild.yaml `_AUTH_SECRET_NAME: auth-session-secret`.
  (b) cloudbuild.yaml: `_AUTH_SECRET_NAME: AUTH_SESSION_SECRET`.
- Evidence: main.tf L283 `secret = env.value`; L375 `secret_id = each.key`;
  cloudbuild.yaml L122, L143.

### B2. startup_probe constraint violation (timeout_seconds must be < period_seconds)
- Provider doc (cloud_run_v2_service > startup_probe):
  `timeout_seconds` (1-3600) MUST be less than `period_seconds`;
  `period_seconds` (1-240) MUST be >= `timeout_seconds`.
- main.tf L249-257: startup_probe `failure_threshold=1`, `period_seconds=240`,
  `timeout_seconds=240` → timeout(240) NOT < period(240). FAILS constraint.
  Also period_seconds max is 240 (at ceiling, valid) but leaves no room for timeout.
- liveness_probe (L259-267) is OK: period=60, timeout=10, failure=3 (10<60, 1-3 ok).
- Fix: set e.g. `timeout_seconds = 120`, `period_seconds = 240` (or timeout=239,period=240).
  Note failure_threshold=1 is within 1-3 (valid) but means a single failed probe = restart;
  consider 3 for production resilience.

---

## WARNINGS (design/ownership conflicts, fix before multi-team use)

### W1. Env-var ownership drift (TF <-> Cloud Build overlap)
- TF `next_env_vars` (dev.tfvars L22-28) defines: BACKEND_URL, GOOGLE_CLIENT_ID,
  GOOGLE_HOSTED_DOMAIN, NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID.
- CB `--update-env-vars` (cloudbuild.yaml L121) sets: NODE_ENV, NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN.
- Overlap: NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID. CB writes live trigger
  values; TF holds placeholders ("YOUR_BACKEND_CLOUD_RUN_URL"). After CB deploy, `terraform plan`
  shows env drift; next `terraform apply` reverts CB values to placeholders.
- TF `lifecycle.ignore_changes` (main.tf L309-311) ignores only image/client/client_version.
  env NOT ignored → TF reasserts env on every apply.
- Recommendation: single owner. Either
  (a) remove NEXT_PUBLIC_* from TF next_env_vars (CB owns build-arg + runtime); TF keeps only
      PORT, BACKEND_URL, GOOGLE_HOSTED_DOMAIN; OR
  (b) keep NEXT_PUBLIC_* in TF with real values and drop them from CB --update-env-vars.
- NOTE on `--update-env-vars` semantics: it MERGES (does NOT wipe unlisted vars), so it is safe
  vs TF-managed server-side vars in general — the problem is only the overlapping keys.

### W2. next_manage_traffic=true vs `--no-traffic` canary workflow
- Provider doc: "If traffic is empty or not provided, defaults to 100% traffic to the latest
  Ready Revision." TF traffic block schema valid: type ∈ {TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST,
  TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION}, percent, revision, tag.
- dev.tfvars L38 sets `next_manage_traffic = true` → TF forces {LATEST, 100%} (main.tf L76-82,
  L299-307). CB deploys `--no-traffic --tag=rev-$SHORT_SHA` (canary, no traffic) then promotes
  via `update-traffic --to-tags=rev-$SHORT_SHA=100`.
- For pure "promote to latest" this works (LATEST == promoted rev) but produces TF plan diff
  (type REVISION→LATEST). For TRUE canary splits (e.g. 10/90) it BREAKS: TF apply re-forces
  100% LATEST, wiping the operator split.
- Fix: set `next_manage_traffic = false` in dev.tfvars for any canary/partial-split workflow
  (traffic omitted → API default 100% LATEST, TF does not fight CB). Comments in main.tf
  L72-75 already document this; the tfvars default contradicts the documented intent.

---

## VERIFIED OK

### V1. Tag-based 100% promotion syntax is VALID
- `gcloud run services update-traffic --to-tags=rev-$SHORT_SHA=100` (cloudbuild.yaml L134-137).
  Format `TAG=PERCENT`[,TAG2=PERCENT2]. `rev-$SHORT_SHA` is the tag assigned at deploy
  (`--tag=rev-$SHORT_SHA`, L120). `--to-tags` + `--tag` are GA since gcloud 332.0.0 (2021-03-16).
  Bare integer = percent. Valid. No change needed.

### V2. TF traffic block schema valid
- type/revision/percent/tag match provider schema; LATEST vs REVISION enum values correct.
  dynamic traffic with empty list when next_manage_traffic=false correctly omits the block.

### V3. Probe schema (other than B2) valid
- startup_probe/liveness_probe blocks, http_get {path,port}, failure_threshold, period_seconds,
  timeout_seconds all valid field names per provider docs. liveness values within constraints.

### V4. Image drift ownership correct
- `ignore_changes = [template[0].containers[0].image, client, client_version]` lets Cloud Build
  own the deployed image; TF seeds placeholder hello:latest then never fights CB deploys. Correct.

### V5. Secret shell pattern sound
- TF creates metadata-only secret shells (no version/value) + grants secretAccessor to
  next_run SA; values populated out-of-band via update_secrets.sh (reads
  `next_secrets_to_populate` output). Pattern is correct; only the secret ID string is wrong (B1).

---

## EXACT RECOMMENDED EDITS (smallest viable diffs)

1. csp/infra/environments/dev-infra-example/dev.tfvars L30-32:
   next_runtime_secrets = {
     AUTH_SESSION_SECRET = "auth-session-secret"
   }

2. csp/infra/modules/platform/main.tf L250-252 (startup_probe):
   failure_threshold = 1     # keep, or raise to 3 for prod
   period_seconds    = 240
   timeout_seconds   = 120   # was 240; must be < period_seconds

3. csp/infra/environments/dev-infra-example/dev.tfvars L38 (if using canary):
   next_manage_traffic = false   # was true; lets CB --no-traffic/update-traffic own traffic

4. (Ownership cleanup, W1) pick owner for NEXT_PUBLIC_API_BASE_URL /
   NEXT_PUBLIC_GOOGLE_CLIENT_ID — remove from TF next_env_vars OR from CB --update-env-vars.

---

## DOCS EVIDENCE (for audit)
- terraform-provider-google r/cloud_run_v2_service: traffic block "If traffic is empty or not
  provided, defaults to 100% traffic to the latest Ready Revision"; traffic.type enum
  {TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST, TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION}.
- startup_probe: timeout_seconds (1-3600, MUST be less than period_seconds); period_seconds
  (1-240, MUST be >= timeout_seconds); failure_threshold (1-3).
- gcloud release notes 332.0.0 (2021-03-16): --tag (deploy/update) and --to-tags/--set-tags/
  --update-tags (update-traffic) promoted to GA.
