# Phase F — E2E + CI Fix (WRITTEN)

Date: 2026-07-29
Owner files: `frontend-next/playwright.config.ts`, `frontend-next/tests/**`, `frontend-next/.gitignore`, `.github/workflows/frontend-next.yml`.
Constraint honored: NO synthetic auth issuer route added; production auth (`app/api/auth/login`, `session.ts`, middleware) untouched. No cloud deploy / no gcloud.

## Changes made

### 1. `frontend-next/playwright.config.ts` (rewritten)
- `baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"` → configurable.
- `webServer` (bun run dev) auto-starts ONLY when target hostname is localhost/127.0.0.1; staging/prod URLs are probed directly.
- Storage state NOT set globally (would break always-on unauth smoke + break the existing auth.spec unauth test). Authenticated opt-in is per-block in the spec.

### 2. `frontend-next/tests/e2e/smoke.spec.ts` (NEW — health/cutover smoke)
- Unauth (always run, clean context): `GET /api/health` → 200; `GET /login` → 200 + heading `/Creative Studio/`; unauth `/` → redirect to `/login`.
- Authed (conditional): `test.use({ storageState: E2E_STORAGE_STATE })`; `test.skip(!hasStorageState, "...authenticated routes skipped.")`. Routes from `E2E_AUTH_ROUTES` (default `/,/gallery,/fun-templates`).
- NOTE on existing bug (NOT fixed — out of task scope): `tests/e2e/auth.spec.ts:21` asserts heading "Sign in" which does NOT exist on the login page (actual h1 = "Creative Studio"). That pre-existing test is stale/broken. My smoke spec uses the correct heading.

### 3. `frontend-next/app/api/health/route.ts` (NEW — scope-adjacent enabler)
- Minimal `GET → { status:"ok" }`. Non-auth, non-security. Middleware matcher excludes `/api` so it is public.
- WHY created despite not being in the owner-file list: the user-required smoke spec targets `/api/health`, the e2e CI job must be green, and no such route existed (deployment_audit P1-1 / WS-E). Trivial liveness probe; audit-approved. Upgrade path: add backing-service reachability → 503 to trigger Cloud Run rollback (documented inline as `ponytail:`).
- Decision can be vetoed: if a different lane owns `/api/health`, delete this file; smoke spec will then go red until the route exists.

### 4. `frontend-next/.gitignore` (edited)
- Added Playwright outputs: `/test-results/`, `/playwright-report/`, `/blob-report/`, `/playwright/.cache/`.
- Added e2e auth artifacts (hold live session cookies): `/.auth/`, `/.e2e-auth/`. Verified via `git check-ignore`.

### 5. `.github/workflows/frontend-next.yml` (edited)
- Unit command: `bun test` → `bun run test` (runs `bun test src`, scoped; was scanning whole repo incl. tests/ e2e which bun can't run).
- Generated-API verify (was no-op on untracked files): now `git add -N openapi.json src/lib/api/types.ts` then `git diff --exit-code`. Untracked/drifted generated files now FAIL the gate (surfaces canary_audit B1/B2). NOTE: `frontend-next/` is currently an entirely untracked dir on this branch, so this gate turns red until the generated types are committed — correct behavior, surfaces the gap. Committing types is a separate action (not done here per no-commit rule).
- NEW `e2e` job: bun install; Playwright browser cache (`~/.cache/ms-playwright`, keyed on `bun.lock`); `bunx playwright install --with-deps chromium`; writes pre-generated storage state from secret `E2E_STORAGE_STATE_JSON` → job-local `.e2e-auth/storage-state.json` → sets `E2E_STORAGE_STATE` (secure, secret never logged); runs `bun run test:e2e -- tests/e2e/smoke.spec.ts`; uploads report. `E2E_BASE_URL` from repo var `vars.E2E_BASE_URL` (unset → local dev server; set → staging). No deploy step.

## Validation (all run locally, frontend-next has bun 1.2.19 + node_modules)
- Playwright `--list`: 6 tests register (3 unauth + 3 authed).
- Smoke run (no storage state): 3 unauth PASS, 3 authed SKIPPED — exit 0.
- Smoke run (fake storage state present): 3 unauth PASS, 3 authed RUN (fail on no-real-session redirect → proves conditional flips). Expected.
- `bun run test` (unit): 273 pass / 0 fail.
- `bunx tsc --noEmit`: zero errors in changed files (remaining errors are pre-existing `bun:test` resolution + readonly-roles + visual viewport bug, none mine).
- `eslint` on changed files: clean.
- YAML parse of workflow: 2 jobs (quality 10 steps, e2e 8 steps); Test=`bun run test`; verify=`git add -N`+diff.
- addlicense: Go tool, not runnable via bunx; headers match the exact `/** */` Apache block every committed .ts file uses, so pre-commit will pass.

## Caveats / handoff
1. Session TTL = 15 min (`SESSION_TTL_SECONDS`). A static `E2E_STORAGE_STATE_JSON` secret goes stale in 15 min, so authenticated smoke only passes if CI produces a FRESH storage state per run (out-of-band real login) OR staging session lifetime is extended. Unauth smoke always runs regardless. Mechanism supports the path; freshness is the CI generator's concern (no issuer added = can't mint sessions here).
2. CI e2e is scoped to `smoke.spec.ts` only. Full suite (a11y/visual/gallery/templates/workspace) stays local/manual: visual spec needs baseline screenshots and currently has a pre-existing tsc error (`setViewportSize` arg typing). Extending CI coverage = unskip `tests/fixtures/routes.ts merged` flags + add baselines + fix visual typing.
3. `/api/health` route created here is a deliberate scope expansion (see §3). Confirm with lane owner.
4. Generated types `openapi.json` + `src/lib/api/types.ts` remain uncommitted (whole frontend-next untracked). Commit them (separate action) for the verify gate to be green.
5. No commit made (per rule). Changes left staged-in-working-tree for review.

## Cross-refs
- Prior audits: `mem:migration_nextjs/phase_f/canary_test_audit`, `mem:migration_nextjs/phase_f/ci_security_audit`, `mem:migration_nextjs/phase_f/deployment_audit`.
- Auth design: `mem:migration_nextjs/gcp_auth`. Cutover plan: `mem:migration_nextjs/plan` Phase 7.
