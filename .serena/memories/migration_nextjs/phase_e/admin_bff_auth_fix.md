# Phase E — Admin BFF auth/security fix

## Scope (4 owned routes, csp/frontend-next)
- `app/api/admin/dashboard/route.ts` (GET, POST)
- `app/api/admin/users/route.ts` (GET, PATCH)
- `app/api/admin/users/[id]/route.ts` (GET, DELETE, POST=restore, PATCH)
- `app/api/admin/ai-providers/[id]/test/route.ts` (POST)

## Changes applied
- Every handler now calls `await requireRole(["admin"])` (first stmt, OUTSIDE try/catch so its NEXT_REDIRECT isn't swallowed).
- Replaced raw `process.env.BACKEND_URL` `fetch` + client `Authorization`/`cookie` forwarding with `requireApiClient()` (session-backed `Bearer <idToken>` server client, `src/lib/api/server.ts`).
- Preserved: query strings (dashboard GET + users GET forward `searchParams.toString()`; dashboard fans same query to all 6 sub-paths); success bodies (users PATCH [id] passthroughs raw `request.text()` → backend `PUT`); status codes (DELETE→204, POST create→201 elsewhere).
- CSRF kept on all mutations: dashboard POST, users PATCH, users/[id] DELETE/POST/PATCH, ai-providers test POST.
- Error handling = sibling convention (`tags`, `ai-providers`, `ai-models`, `media-gallery`, `templates`): try/catch, status from `ApiError.status` (else 500), body `{ error: message }`.

## Body-shape normalization (intentional, NOT a regression)
- users routes previously returned FastAPI `{ detail: ... }` for CSRF/validation errors; normalized to `{ error: ... }` to match all migrated sibling routes.
- Verified safe: only consumers (`use-admin-users.ts`, `app/(admin)/admin/users/page.tsx`, dashboard `page.tsx`) check `response.ok` and never read `detail`/`error` key.

## ⚠️ CLIENT FOLLOW-UP REQUIRED (page owned elsewhere — NOT edited)
Dashboard "Clean stuck jobs" is a plain HTML form:
`app/(admin)/admin/page.tsx` → `<form action="/api/admin/dashboard" method="post">`.
Plain forms CANNOT set the `x-csrf-token` header that `verifyCsrf` requires, so dashboard POST now ALWAYS returns 403.
Fix (page owner): replace plain form with a client fetch that sends `x-csrf-token` header (read `csp_csrf` cookie). Pattern already exists in `src/features/admin/hooks/use-admin-users.ts` (`csrf()` helper + `options()`). Backend `POST /api/admin/cleanup-stuck-jobs` returns `{message, count}`.

## Auth helpers (reference)
- `requireApiClient()` → `src/lib/api/server.ts`; builds `ApiClient` (`src/lib/api/client.ts`) with `Authorization: Bearer <session.idToken>`; throws `Error("Unauthorized")` if no session (but `requireRole` redirects first).
- `requireRole(roles)` → `src/lib/auth/server.ts`; redirects `/login` (no session) or `/` (missing role).
- `verifyCsrf(cookieToken, headerToken)` + `CSRF_COOKIE` ("csp_csrf") → `src/lib/auth/session.ts`.

## Validation
- Diagnostics clean on all 4 files (TS server-only, no errors/warnings).
- Did NOT run backend/next build (no standing docker env per isolation rule); type-check via editor diagnostics only.

## Out of scope (not touched)
- Other admin routes already migrated (`ai-providers`, `ai-models`, `tags`, `media-gallery`, `templates`, `brand-guidelines`).
- Dashboard page + UsersTable client components (owned elsewhere).
