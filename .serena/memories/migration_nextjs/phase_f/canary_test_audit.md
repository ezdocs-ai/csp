# Phase F — read-only audit: frontend-next Playwright + cutover readiness

Written 2026-07-29. Read-only review of `frontend-next/playwright.config.ts`, `frontend-next/tests/**`, `frontend-next/app/api/auth/**`, `frontend-next/src/lib/auth/**`, `infra/environments/dev-infra-example/dev.tfvars`, `.github/workflows/frontend-next.yml`. No files edited, no docs created.

## 1. Findings (current state)

### 1a. Configurable deployed baseURL — MISSING
`frontend-next/playwright.config.ts`:
- `use.baseURL` hardcoded `"http://localhost:3000"`.
- `webServer` autostarts `bun run dev -- --port 3000` against localhost only.
- No env override (no `process.env.PLAYWRIGHT_BASE_URL`).
- `reuseExistingServer: true` allows pointing a manually started server, but nothing in repo wires a deployed URL.
Deployed service name per `infra/environments/dev-infra-example/dev.tfvars:8` → `next_service_name = "creative-studio-next"`. Final URL is Cloud Run autodomain OR Firebase Hosting rewrite — neither captured anywhere for test targeting.

### 1b. Authenticated session setup — MISSING (BLOCKER)
Session cookie `csp_session` is HS256 JWT signed in `app/api/auth/login/route.ts` after real Google credential verify (`verifyGoogleCredential`). No test-only session issuer exists.
- No `globalSetup`, no `storageState`, no `*.auth.ts` fixture anywhere under `frontend-next/tests/**`.
- `tests/e2e/auth.spec.ts:31` explicitly `test.skip(true, "No test-only session issuer: real Google login remains manual.")`.
Consequence: every studio/admin/gallery/templates/workspace spec requiring login cannot run in CI. CI workflow `.github/workflows/frontend-next.yml` only invokes `bun test` (unit); it never invokes `bun run test:e2e` → entire Playwright suite is dark.

### 1c. Smoke routes — MINIMAL
Active e2e (not skipped):
- `auth.spec.ts:19` login renders GIS container.
- `auth.spec.ts:25` unauth `/` → `/login?next=…` redirect.
Skipped via `tests/fixtures/routes.ts merged = {gallery:false, workspace:false, templates:false}`:
- `gallery.spec.ts`, `templates.spec.ts`, `workspace.spec.ts` entire describes.
- `auth.spec.ts:30` non-admin admin redirect (manual).
No HTTP-status smoke probe (e.g. `GET /login` → 200, `GET /` → 302/307), no API health check, no `/api/auth/csrf` liveness check. Visual + a11y suites only hit `/_visual` internal fixture.

### 1d. Rollback health criteria — MISSING
- No spec asserting a health endpoint.
- No definition of "rollback health gate" anywhere (no `/healthz`, no Cloud Run `execProbe` referenced in Playwright context).
- `cloudbuild.yaml` deploys but runs no post-deploy smoke step.
- Phase 7 cutover (mem: complete.md §6 item 6) lists canary/rollback as still-pending.

### 1e. Performance / upload / polling coverage — MISSING (e2e)
- **Upload**: `src/features/brand-guidelines/components/brand-guideline-upload.tsx` (500 MB PDF, signed-URL PUT) — no e2e. No source-asset upload e2e.
- **Polling**: `src/lib/hooks/use-media-job.ts` + `src/components/studio/job-poller.tsx` (5 s interval, `document.hidden` guard) — no e2e exercises polling terminal states.
- **Performance**: no Playwright web-vitals, no Lighthouse, no `expect(response).timings` budget.
Unit coverage exists for some of these (`src/features/brand-guidelines/__tests__`, etc.) but no e2e journey through generation + poll + result.

## 2. Gaps blocking cutover canary

| Gap | File missing | Impact |
|---|---|---|
| baseURL env override | `frontend-next/playwright.config.ts` | cannot target staging/prod |
| Test-only session issuer | `frontend-next/app/api/auth/__dev__/route.ts` (new) OR fixture | all authed specs skip |
| Playwright global auth setup | `frontend-next/tests/auth.setup.ts` + storageState | no shared session |
| Unskip merged routes | `frontend-next/tests/fixtures/routes.ts` | gallery/templates/workspace skip |
| Smoke spec (HTTP + authed root) | `frontend-next/tests/e2e/smoke.spec.ts` | no liveness gate |
| Perf budget | `frontend-next/tests/perf/vitals.spec.ts` | no regression guard |
| Upload/poll e2e | `frontend-next/tests/e2e/upload.spec.ts`, `polling.spec.ts` | cutover blind spots |
| CI e2e job | `.github/workflows/frontend-next.yml` | Playwright never runs |
| Rollback probe contract | (decision + smoke route) | no auto-rollback trigger |

## 3. Minimal implementation plan (exact files)

Each row is a single small change. No new libs; everything uses installed `@playwright/test` + stdlib.

1. **Env-driven baseURL + conditional webServer** — edit `frontend-next/playwright.config.ts`:
   - `use.baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"`.
   - Wrap `webServer` so it only auto-starts when `E2E_BASE_URL` unset.
   - Add `projects: [{ name: "setup", testMatch: /.*\.setup\.ts/, ... }, { name: "chromium", dependencies: ["setup"], use: { storageState } }]` once auth setup lands.

2. **Test-only session issuer (dev-only)** — new `frontend-next/app/api/auth/__dev__/session/route.ts`:
   - Gated on `process.env.NODE_ENV !== "production"` AND `process.env.E2E_TEST_SESSION_SECRET === AUTH_SESSION_SECRET` (rotated per CI run).
   - Calls existing `signSession()` from `src/lib/auth/session.ts` with a synthetic `SessionInput` (roles: `["admin","user"]` for full coverage). No `verifyGoogleCredential` path; backend `/api/users/me` bypassed by injecting the same `idToken` only when backend is mocked — else keep role allowlist.
   - HTTP-only, same-site lax, mirrors `sessionCookie()`. Adds `csrf` cookie via existing `csrfCookie()`.

3. **Playwright auth setup** — new `frontend-next/tests/auth.setup.ts`:
   - `request.post("/api/auth/__dev__/session", { data: {...} })` → grab `Set-Cookie`, write `tests/.auth/admin.json` storageState.
   - Add `.auth/` to `frontend-next/.gitignore`.

4. **Unskip merged routes** — edit `frontend-next/tests/fixtures/routes.ts`: set `gallery/workspace/templates = true` (or read from `process.env.E2E_MERGED_*`).

5. **Smoke spec** — new `frontend-next/tests/e2e/smoke.spec.ts`:
   - `GET /login` → 200; `GET /api/auth/csrf` → 200.
   - Authed: `GET /` → 200 (no redirect), `GET /gallery`, `/fun-templates`, `/admin` 200.
   - Health/rollback probe: `GET /api/auth/csrf` 5xx rate over 3 quick calls → abort (rollback trigger candidate).

6. **Upload + polling e2e** — new `frontend-next/tests/e2e/journeys.spec.ts`:
   - Brand-guideline upload: synthetic PDF via `Blob`, assert toast progression + terminal status (mocked backend or staging).
   - Generation poll: assert `JobPoller` aria-live transitions `processing → completed`.

7. **Perf budget** — new `frontend-next/tests/perf/vitals.spec.ts`:
   - Inline `performance.getEntriesByType("navigation")` for LCP/TTFB; assert LCP < 2500 ms on `/`, `/gallery`, `/login`.

8. **CI e2e job** — edit `.github/workflows/frontend-next.yml`: add `e2e` job runs-on ubuntu, `bun install`, start dev server, `bunx playwright test --project=chromium`, upload HTML report on fail. Use `E2E_TEST_SESSION_SECRET` from Actions secret.

9. **Rollback criteria** — decision + new `frontend-next/tests/e2e/health.spec.ts`: define `ROLBACK_HEALTH = {"/login":200, "/api/auth/csrf":200, authed "/":200}` all must pass within 60 s of deploy. Document inline as the canary gate (referenced from mem: migration_nextjs/plan Phase 7.4).

## 4. Out of scope (intentionally skipped)
- Replacing GIS OIDC login in prod (security boundary — keep real).
- Adding `@axe-core/playwright` (a11y.spec.ts intentionally avoids the dep).
- Backend changes (authed journeys need backend `/api/users/me` to accept synthetic idToken, OR backend test-mode flag — flagged as backend lane task).
- Live Angular↔Next parity replay (Phase 7.1, not test-infra work).

## 5. Cross-refs
- Auth design: `mem:migration_nextjs/gcp_auth`, `mem:migration_nextjs/phase_e/admin_bff_auth_fix`.
- Migration plan Phase 7 (cutover): `mem:migration_nextjs/plan` §Phase 7.
- Final migration status incl. Phase 7 not-started: `mem:migration_nextjs/complete.md` §6.6.
- Phase E green build/lint/test rollup: `mem:migration_nextjs/phase_e/status.md`.
