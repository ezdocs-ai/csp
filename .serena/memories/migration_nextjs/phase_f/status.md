# Phase F — Cloud Run-only cutover readiness complete

Date: 2026-07-29
Status: implementation and local validation COMPLETE. Next.js has no Firebase integration. No cloud resources changed.

## Deployment model
- Next.js runs directly on Cloud Run using `output: "standalone"` and the non-root Docker runtime.
- Cloud Build verifies, builds, pushes an immutable SHA image, deploys a tagged `--no-traffic` Cloud Run revision, and promotes only an explicit tested `_PROMOTE_TAG`.
- Terraform configures the Next Cloud Run service, probes, concurrency/timeout, Secret Manager metadata/access, CORS, and leaves canary traffic to Cloud Build in the example environment.
- Google Identity Services/FedCM login remains intact; it is not Firebase Authentication.
- The existing Angular Firebase deployment remains isolated as legacy rollback infrastructure and is not a Next dependency.

## Firebase removal
Removed from `frontend-next`:
- `firebase.json`
- `.firebaserc`
- `scripts/firebase-canary.ts`
- `.firebase-canary/` ignore entry
- Firebase Hosting host defaults (`*.web.app`, `*.firebaseapp.com`)
- Firebase-specific Next comments/tests

No Firebase SDK/package dependency existed. No Next Cloud Build, GitHub Actions, Docker, or Terraform deployment step invokes Firebase. Generated backend API descriptions may still contain the word `Firestore`; those are backend-owned contract text, not frontend integration.

## Security and readiness
- CSP/security headers, production HSTS, trusted-host validation, and `/api/health` remain enabled.
- Empty `ALLOWED_HOSTS` defaults now permit only localhost/127.0.0.1 and standard `*.run.app`; production should configure exact public/custom domains.
- `AUTH_SESSION_SECRET` is consistently named across Terraform and Cloud Build; Terraform creates metadata only, never a value.
- Startup probe timing is valid (`timeout_seconds=120 < period_seconds=240`).
- API generation fails closed if `openapi.json` is absent.

## Validation after Firebase removal
- `bun run build`: PASS (Next.js 16.2.11, TypeScript pass, 59/59 pages).
- `bun run lint`: PASS.
- `bun run test`: PASS — 273 tests, 0 failures, 600 assertions, 42 files.
- Playwright Chromium smoke: 3 unauthenticated passed; 3 authenticated skipped without a fresh storage state.
- Grep of `frontend-next` app/source/scripts/public and top-level config: no Firebase references.
- `git diff --check -- frontend-next`: PASS.
- Scoped containerized pre-commit: PASS.
- Independent final removal review: no blockers (`mem:migration_nextjs/phase_f/remove_firebase_final_review`).

## Operator actions before canary
1. Review/commit the complete `frontend-next` tree, including `openapi.json` and generated API types.
2. Populate Secret Manager `AUTH_SESSION_SECRET` with a cryptographically random value of at least 32 characters.
3. Replace Terraform placeholders with real Cloud Run/backend/Google client values and define production `ALLOWED_HOSTS`.
4. Run the normal Cloud Build path to deploy a tagged zero-traffic revision.
5. Test the Cloud Run tag URL with a fresh authenticated Google session/storage state.
6. Promote only with `_PROMOTE=true,_PROMOTE_TAG=rev-<tested-sha>` after sign-off.
7. Keep the Angular deployment only for the planned rollback window; retire it separately after production stability.

## Hard stop honored
No `terraform apply`, gcloud invocation, Cloud Build submission, Cloud Run deployment/promotion, DNS change, secret population, or production traffic change was performed.

Cross-references:
- `mem:migration_nextjs/phase_f/remove_firebase_frontend_audit`
- `mem:migration_nextjs/phase_f/remove_firebase_infra_audit`
- `mem:migration_nextjs/phase_f/remove_firebase_final_review`
- `mem:migration_nextjs/phase_f/final_diff_review`
