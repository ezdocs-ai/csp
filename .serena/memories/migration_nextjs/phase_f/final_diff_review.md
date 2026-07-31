# Phase F Final Diff Review (post-blocker-fix)

Scope: read-only review of final Phase F changes. Docs consulted: Cloud Run
probes/traffic flags (cloud.google.com), Firebase Hosting Cloud Run rewrites +
pinTag (firebase.google.com/docs/hosting/cloud-run, full-config), Next.js
standalone output (nextjs.org/docs/app/api-reference/config/next-config-js/output).

## Blocker-fix verification (all PASS)

1. startup timeout < period — PASS
   infra/modules/platform/main.tf:250-256: period_seconds=240, timeout_seconds=120.
   120 < 240. Liveness 60/10 also valid.

2. trigger supplies all required public substitutions + secret name — PASS
   cloudbuild.yaml Verify step (L46-51) requires _NEXT_PUBLIC_GOOGLE_CLIENT_ID,
   _NEXT_PUBLIC_APP_URL, _NEXT_PUBLIC_API_BASE_URL (hard exit 1 on empty).
   main.tf L326-335 trigger.substitutions supplies all 3 + FEATURE flag default +
   _AUTH_SECRET_NAME via lookup(next_runtime_secrets, "AUTH_SESSION_SECRET",
   "AUTH_SESSION_SECRET"). No missing required substitution.

3. secret ID consistent across pipeline — PASS
   dev.tfvars next_runtime_secrets = { AUTH_SESSION_SECRET = "AUTH_SESSION_SECRET" }
   -> trigger _AUTH_SECRET_NAME = "AUTH_SESSION_SECRET" -> cloudbuild Deploy
   --update-secrets=AUTH_SESSION_SECRET=${_AUTH_SECRET_NAME}:latest (cloudbuild.yaml
   L124) -> env var name AUTH_SESSION_SECRET. Chain consistent.

4. traffic ownership false in example — PASS
   dev.tfvars L39: next_manage_traffic = false. main.tf L76-82 local
   next_traffic_targets => [] when false; dynamic traffic block iterates empty =>
   Terraform emits no traffic block. Won't fight --no-traffic canary.

5. promotion uses explicit tag — PASS
   cloudbuild.yaml Promote step L135-140: errors exit 1 when _PROMOTE_TAG empty;
   uses --to-tags=${_PROMOTE_TAG}=100 (explicit tag, not LATEST). --to-tags GA per
   Cloud SDK docs.

6. API generation fails closed — PASS
   cloudbuild.yaml L53: `if [ ! -f openapi.json ]; then exit 1`.
   scripts/gen-api.ts L27: process.exit(result.status ?? 1). Empty/absent spec
   aborts pipeline before image build. CI workflow also git-add -N + diff gate.

7. Firebase pinTag validated — PASS
   firebase.json both rewrites pinTag:true (L17,L25). scripts/firebase-canary.ts
   L84: FAIL when r.run.pinTag !== true. Per Firebase docs pinTag:true syncs Cloud
   Run revision with Hosting deploy, enables preview channels.

8. no cloud action in canary script — PASS
   scripts/firebase-canary.ts: imports readFileSync/writeFileSync only; no deploy,
   no fetch, no gcloud/firebase CLI. validate() + resolveTokens() pure local.
   firebase.json/.firebaserc use NEXT_*_PLACEHOLDER tokens, resolved to out dir.

## Blockers

NONE. All 8 claimed fixes verified against current source + official docs.

## Non-blocking observations (informational, no action required)

- cloudbuild Deploy --update-env-vars=NODE_ENV=production (L123) is a merge, not
  replace; preserves TF-managed server-side vars. Correct per comment.
- main.tf L235 placeholder image hello:latest; lifecycle.ignore_changes covers
  template[0].containers[0].image so Cloud Build owns image. By design.
- .dockerignore excludes openapi.json + **/*.test.* / *.spec.*; build stage only
  needs .next output, not spec files. Fine.
- next.config.ts output:"standalone"; Dockerfile copies .next/standalone +
  .next/static + public; CMD node server.js. Matches Next.js standalone docs.
- startup_probe failure_threshold=1 + 240s period is aggressive but intentional
  for fast canary rollback. Acceptable.
- health route (app/api/health/route.ts) liveness-only; ponytail comment notes
  backing-service check deferred. Acceptable per stated ceiling.

## Conclusion
Phase F blocker fixes hold. No remediation required for merge.
