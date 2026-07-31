# Internal BFF `/api/*` fetch audit (Server Components)

Scope: READ-ONLY audit of Next.js **Server Components** in `frontend-next/app/**`
that issue absolute same-origin `/api/*` fetches. Two anti-patterns flagged:
(1) omit incoming request cookies (route handlers gate on session cookie → redirect),
(2) blind `response.json()` after a followed redirect returns HTML.

## Existing helper (reuse target — do NOT duplicate)

- `src/lib/api/server.ts`
  - `getServerApiClient(): Promise<ApiClient | null>` — returns null when no session.
  - `requireApiClient(): Promise<ApiClient>` — throws `ApiError{status:401, code:"NO_SESSION"}` when no session.
  - Backed by `createApiClient` (`src/lib/api/client.ts`): `baseUrl = BACKEND_URL ?? NEXT_PUBLIC_API_BASE_URL`,
    `getHeaders = () => ({ Authorization: "Bearer " + session.idToken })`, `"server-only"` guard.
  - Bypasses internal `/api/*` routes entirely, attaches idToken server-side, token never reaches client.
  - All `app/api/admin/*/route.ts` handlers ALREADY use this — they are thin proxies.
  -=> Smallest refactor: Server Components should call `requireApiClient()` directly against the same
      backend path the route handler uses, dropping the self-fetch entirely.

## Affected files

### 1. `app/(admin)/admin/ai-models/page.tsx` (line 15) — BOTH bugs
- Absolute fetch `${NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/ai-models`, `cache:"no-store"`.
- **No cookie forwarded** → route handler `requireRole(["admin"])` → no session → `redirect("/login")`.
- `fetch` follows redirect → `/login` HTML 200 → `response.ok` true → `await response.json()` throws SyntaxError.
- Currently swallowed by surrounding `try/catch` (silent empty list). Bug masked, not fixed.
- Fix: `const initial = await (await requireApiClient()).get<AiModel[]>("/api/admin/ai-models");`
  (wrap in try/catch keeping `[]` fallback; `requireApiClient` throws 401 on no session — handle or let RSC error boundary catch).

### 2. `app/(admin)/admin/ai-providers/page.tsx` (line 15) — BOTH bugs
- Identical pattern to ai-models. Masked by try/catch.
- Fix: `requireApiClient().get<AiProvider[]>("/api/admin/ai-providers")`.

### 3. `app/(admin)/admin/users/page.tsx` (line 12) — BOTH bugs, UNHANDLED
- Absolute fetch `/api/admin/users?${query}`, `cache:"no-store"`.
- **No cookie forwarded** → redirect to `/login` → HTML 200 → blind `response.ok ? await response.json() : {items:[]}`.
- NO try/catch → `.json()` on HTML throws → **page crashes for every admin** (cookies never forwarded server-side).
- Fix: `const users = await (await requireApiClient()).get<AdminUsersResponse>("/api/users?" + query);`
  with try/catch → `{items:[]}` fallback.

### 4. `app/(admin)/admin/page.tsx` (line 49) — partial: cookies forwarded, json still blind
- Absolute fetch `/api/admin/dashboard?${query}`, `cache:"no-store"`.
- **Cookies ARE forwarded**: `headers: { cookie: (await headers()).get("cookie") ?? "" }` (line 48,51). Session preserved, no redirect. ✓
- Still does blind `response.ok ? await response.json() : fallback`. Low risk (route always returns JSON), but inconsistent + self-hop wasted.
- Fix: replace with `requireApiClient()` calling the 6 backend paths the route aggregates
  (`/api/admin/overview-stats`, `media-over-time`, `active-roles`, `generation-health`, `workspace-stats`,
   `active-users-monthly`) via `Promise.all` — mirrors `app/api/admin/dashboard/route.ts` exactly,
  or simpler: keep single fetch but switch to `requireApiClient().get("/api/admin/dashboard?"+query)` after
  forwarding is removed (handler still reads its own cookie via `requireRole`). Preferred: drop self-fetch,
  call backend paths directly to eliminate the extra internal HTTP hop.

## Non-Server-Component fetches (OUT OF SCOPE — client-side, fine)

All `src/features/**` + `app/(public)/login/login-client.tsx` fetches are Client Components / hooks
(browser context — cookies auto-attached, CSRF via `x-csrf-token`, no same-origin redirect issue).
NOT flagged. Do not touch.

## Recommendation summary

- Single helper to adopt: `requireApiClient()` from `src/lib/api/server.ts`.
- Per-page change ≈ 3–5 lines: remove `fetch(...)`, call `requireApiClient().get<T>(backendPath)`,
  keep existing fallback shape. No new abstraction, no token exposure, no client fetch.
- Priority order: users (crash) > ai-models ≈ ai-providers (masked) > dashboard (cosmetic).
- Optional follow-up: delete now-redundant internal GET handlers if no client hook still calls them
  (client hooks DO call `/api/admin/*` — keep handlers, only refactor Server Components).

## Verification hooks (when implementing)
- `requireApiClient()` throws `ApiError` on missing session; RSC render throws → `error.tsx` boundary.
  Decide per-page: catch → empty fallback (current UX) vs. propagate → error boundary.
- Backend paths confirmed from route handlers: ai-models `/api/admin/ai-models`,
  ai-providers `/api/admin/ai-providers`, users `/api/users?${query}`, dashboard 6 paths above.
