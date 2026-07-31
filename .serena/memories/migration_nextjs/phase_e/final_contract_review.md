# Phase E — Final read-only contract/security review

Date: 2026-07-29 (rev2 after B1/B2 fixes). Scope: workflows editor/run/BFF, admin templates/tags/media-gallery/AI GET auth, source-assets, brand-guidelines. Compare backend DTO/controllers. Look for 400/403/422, missing CSRF, wrong casing, auth bypass, unsafe client trust. NO edits made.

Auth model: session JWT cookie `csp_session` (HS256) → `requireApiClient()` injects `Authorization: Bearer ${session.idToken}` to backend. Backend `OAuth2PasswordBearer` requires Bearer; does NOT read cookies. CSRF = double-submit cookie `csp_csrf` + `x-csrf-token` header, constant-time `verifyCsrf`. Middleware gates page routes only (matcher excludes `/api`), so `/api/admin/*` relies on per-route `requireRole(["admin"])`.

## rev2 VERIFICATION — B1/B2 fixed, NO blockers remain

### B1 RESOLVED — `frontend-next/app/api/admin/dashboard/route.ts`
- GET L23-36: `requireRole(["admin"])` ✓ + `requireApiClient()` ✓ (injects Bearer from session.idToken, no more raw `authorization` forward). Parallel `api.get` over 6 admin paths, returns `{overview, mediaOverTime, activeRoles, generationHealth, mediaPerWorkspace, monthlyActiveUsers}`.
- POST L38-49: `requireRole(["admin"])` ✓ + `verifyCsrf` ✓ + `requireApiClient().post("/api/admin/cleanup-stuck-jobs")` ✓.
- Session-cookie forwarding: page `(admin)/admin/page.tsx:75-79` server-component `fetch` to own BFF explicitly forwards `headers: { cookie: incomingHeaders.get("cookie") }` → BFF `cookies()` reads `csp_session` ✓. (Server-side internal fetch needs explicit cookie; browser auto-send doesn't apply.)
- CSRF cleanup flow: `CleanupStuckJobsButton` (`src/features/admin/components/cleanup-stuck-jobs-button.tsx`) is a client component; `fetch("/api/admin/dashboard", {method:"POST", headers:{"x-csrf-token": csrfToken()}})` — browser auto-sends `csp_session`+`csp_csrf` same-origin ✓, CSRF read from cookie via `csrfToken()` ✓. Replaced broken `<form method=post>`.

### B2 RESOLVED — `frontend-next/app/api/admin/users/route.ts` + `admin/users/[id]/route.ts`
- `users/route.ts` GET L21-29 `requireRole`+`requireApiClient` ✓; PATCH L31-43 `requireRole`+`verifyCsrf`+`requireApiClient().put(/api/users/${id})` ✓, validates `id` (L37).
- `users/[id]/route.ts` GET L23, DELETE L34, POST L49, PATCH L63 — all `requireRole(["admin"])` ✓ + mutations have `verifyCsrf` ✓ + `requireApiClient` ✓.
- Client `use-admin-users.ts`: GET (L22) no CSRF needed, browser auto-sends session cookie ✓; PATCH/DELETE/POST (L30/36/37) use `options()` with `x-csrf-token` header + auto cookie ✓.

### BFF-wide sweep: zero raw `authorization`/`cookie` header forwarding remaining
`grep` for `request.headers.get("authorization")` / `get("cookie")` in `app/api/` → NO matches. Both broken patterns eliminated.

## Conclusion (rev2)
**0 contract blockers.** Session-cookie forwarding functional (dashboard via explicit server-side cookie header; client components via browser same-origin auto-send). CSRF cleanup flow functional (double-submit `csp_csrf` cookie + `x-csrf-token` header; client reads cookie, BFF constant-time verifyCsrf). All admin mutations now have `requireRole`+`verifyCsrf`+`requireApiClient`.

## NON-BLOCKER ADVISORIES (unchanged from rev1, all low-priority)

- **A1** `admin/ai-providers/[id]/test/route.ts` POST missing `requireRole(["admin"])` (siblings have it). Backend router-level `RoleChecker(ADMIN)` gates → NOT a real bypass. Add for consistency.
- **A2** `requireRole` does `redirect()` not 403 JSON (`src/lib/auth/server.ts:37`) → forbidden direct API hits get HTML 302→200. Masked by page middleware; no leak.
- **A3** Workflow per-step `inputs`/`settings` empty → 422 until editor rebuild (tracked in `mem:migration_nextjs/phase_e/workflow_contract_fix`).
- **A4** `workflows/[id]/executions` response untyped in OpenAPI; client uses fallback chain — verify backend shape.
- **A5 (new)** `CleanupStuckJobsButton` reads `body?.message` from cleanup-stuck-jobs response; if backend returns no `message`, toast falls back to "Stuck jobs cleaned up." Cosmetic.
- **A6 (new)** `(admin)/admin/page.tsx:19-22` comment now stale (says route forwards only 4 series; route forwards all 6 incl. mediaPerWorkspace/monthlyActiveUsers). Doc-only.

## VERIFIED CLEAN (in-scope, no blockers)
- **Workflows editor/run/BFF**: `WorkflowCreateDto`={name,description,steps}; mapper emits `{stepId,type,inputs,settings,outputs}` (camel aliases, `populate_by_name=True`). Search forwards `{limit,offset,name}` = `WorkflowSearchDto` ✓. Run hooks send `workspaceId` → BFF injects `workspace_id` ✓. CSRF on mutations ✓. Executions GET forwards `limit/page_token/status` ✓.
- **Admin templates/tags/media-gallery/AI GET**: `requireRole(["admin"])`+CSRF on mutations ✓; casing matches DTOs ✓.
- **Source-assets**: backend clears admin filters + ownership-scoped → no IDOR ✓.
- **Brand-guidelines**: camel/snake casing verified via OpenAPI ✓.
- **Admin dashboard/users** (rev2): fully migrated to `requireApiClient`+`requireRole`+CSRF ✓.
