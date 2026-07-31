# Phase F — READ-ONLY audit: Next.js Firebase coupling for Cloud Run-only deployment

Written 2026-07-29. READ-ONLY. No files edited, no terraform/gcloud/firebase run. Goal: Next
deployed Cloud Run-only; Angular Firebase integration UNTOUCHED. Identifies ONLY Next-specific
Firebase coupling + required CORS/outputs/comment changes.

## Key finding: Terraform/Docker/deployment config has ZERO Next→Firebase coupling already
- `infra/modules/platform/main.tf` Next wiring is pure Cloud Run: `google_cloud_run_v2_service.next`
  (run.app), `google_artifact_registry_repository.next`, `next_run`/`next_trigger` SAs, AR/CR IAM,
  `google_cloudbuild_trigger.next` → `frontend-next/cloudbuild.yaml`.
- `local.next_frontend_url` (main.tf L57) = `https://<svc>-<projnum>.<region>.run.app` — NOT Firebase.
- Angular Firebase wiring (`google_firebase_project.default` L150-153, `module "frontend_service"`
  → `firebase-hosting-service`, `firebase_site_id`, `local.frontend_url` = `*.web.app`) is Angular
  ONLY. No second firebase-hosting-service instantiation for Next. UNTOUCHED by this audit.
- `frontend-next/cloudbuild.yaml` is already Cloud Run-only: `gcloud run deploy --no-traffic --tag`
  + `update-traffic --to-tags`. NO `firebase deploy` step. No-traffic/tag/promote canary is
  Cloud Run-native, independent of Firebase Hosting.
- `frontend-next/Dockerfile`/`next.config.ts` core: no Firebase coupling (`output:"standalone"`,
  `node server.js`, PORT 8080).

## Next-specific Firebase coupling (ALL of it lives in frontend-next/, 4 items) — REMOVE for Cloud Run-only
1. `frontend-next/firebase.json` (entire file, 40 lines) — Firebase Hosting canary TEMPLATE: single
   `hosting` object, `site`=`NEXT_CANARY_SITE_ID_PLACEHOLDER`, rewrites `/api/**`+`**` →
   `{run:{serviceId,region,pinTag:true}}` Next Cloud Run; `/api/**` no-store header.
2. `frontend-next/.firebaserc` (entire file, 5 lines) — `projects.default`=`PROJECT_ID_PLACEHOLDER`.
3. `frontend-next/scripts/firebase-canary.ts` (entire file, 202 lines) — bun validate/resolve script
   for the canary config (no-deploy/no-network). Dead once hosting config removed.
4. `frontend-next/.gitignore` L47-49 — remove the resolved-output ignore block:
   ```
   # firebase canary resolved config (generated, never deploy from this repo)
   /.firebase-canary/
   ```
   (delete L47 + L48 + the blank L49 separating from `# typescript` L50).
Verified clean removal: grep repo-wide for `firebase-canary|\.firebaserc|canary` — only matches are
these 4 files + `.serena` memories (no package.json script, no cloudbuild step, no CI workflow,
no README/AGENTS.md reference). `package.json` only defines `gen:api`; no firebase script.

## REQUIRED comment change (1)
5. `frontend-next/next.config.ts` L33 — HSTS comment now inaccurate for Cloud Run-only Next
   (Firebase no longer terminates TLS upstream for Next):
   - OLD: `  // HSTS only in production; Cloud Run / Firebase terminate TLS upstream.`
   - NEW: `  // HSTS only in production; Cloud Run terminates TLS upstream.`
   (Comment-only; no behavior change. HSTS gate already keyed on `isProduction`.)

## CORS — NO change required (zero-diff, already Cloud Run-correct)
- main.tf L63: `"CORS_ORIGINS" = jsonencode(distinct(concat([local.frontend_url, local.next_frontend_url], var.be_cors_extra_origins)))`.
- `next_frontend_url` = run.app (Cloud Run). No Firebase URL used for Next in CORS. Browser
  client-direct calls from Next (run.app origin) covered; BFF server-side calls to backend bypass
  CORS. Removing canary hosting makes CORS MORE correct (canary `*.web.app` domain was never in
  CORS anyway). Zero edit.
- Angular `frontend_url` (`*.web.app`) entry UNTOUCHED — stays for Angular. Correct.

## Outputs — NO change required (zero-diff)
- `infra/modules/platform/outputs.tf` + `infra/environments/dev-infra-example/outputs.tf` Next
  outputs (`next_service_url`, `next_service_name`, `next_service_location`,
  `next_latest_ready_revision`, `next_secrets_to_populate`) all read
  `google_cloud_run_v2_service.next` (run.app). No Next→Firebase output exists. Zero edit.

## OPTIONAL — NOT required for Cloud Run-only (flag only; operator decision)
- `frontend-next/src/lib/security/hosts.ts` L28-36: `DEFAULT_HOST_PATTERNS` includes `*.web.app`
  (// Firebase Hosting) + `*.firebaseapp.com`, and comment L28 says "Cloud Run / Firebase Hosting".
  These are permissive trusted-host-guard SECURITY DEFAULTS, NOT deployment coupling — Next does
  not depend on Firebase to deploy/run. Harmless; removing tightens the Host allowlist
  (security improvement) but isn't required for Cloud Run-only operation. Note: this is app-layer
  security config, outside stated "Terraform/Docker/deployment config" scope. Test
  `src/lib/security/__tests__/hosts.test.ts` asserts these defaults (3 expects) — removing patterns
  = update that test too.
- `infra/modules/platform/variables.tf` L175 + `dev.tfvars` L44 comments say "Firebase + Next" /
  "besides the Firebase and Next.js service URLs" — STILL ACCURATE (Firebase=Angular frontend_url,
  Next=run.app). No change.

## Minimal edit set summary (exact)
- DELETE: `frontend-next/firebase.json`
- DELETE: `frontend-next/.firebaserc`
- DELETE: `frontend-next/scripts/firebase-canary.ts`
- EDIT   `frontend-next/.gitignore`: drop L47-49 (`/.firebase-canary/` block + blank line).
- EDIT   `frontend-next/next.config.ts` L33: comment "Cloud Run / Firebase" → "Cloud Run".
- CORS/outputs/Terraform/cloudbuild/Docker: NO edit (already Cloud Run-only; Angular Firebase untouched).

## Angular Firebase isolation — confirmed safe
- Angular `frontend/firebase.json` + `frontend/.firebaserc` + `frontend/cloudbuild-deploy.yaml` +
  `frontend_secrets` (FIREBASE_* secret-manager module) + `firebase-hosting-service` module call +
  `firebase_site_id` var: NONE referenced by any Next-side file or Next Terraform resource. Removing
  the 4 Next Firebase files above does not touch any Angular Firebase path.

## Validation status
- READ-ONLY audit; no build/lint/test run (no edits made). Recommended post-edit checks (when applied):
  `bun run build && bun run lint && bun run test` in frontend-next (removing canary script + config
  must not break build; hosts.ts untouched in required set).
- Cross-refs: `mem:migration_nextjs/phase_f/firebase_canary_fix` (created the 4 files),
  `mem:migration_nextjs/phase_f/final_canary_review`, `mem:migration_nextjs/phase_f/deployment_audit`
  (WS-C), `mem:migration_nextjs/phase_f/final_infra_review`.
