# Admin Server-Side Fetch — Final Review (users / ai-models / ai-providers)

Read-only review of the three Next.js admin server pages that call backend
directly via `requireApiClient`. Scope: backend paths vs BFF routes, token
server-only guarantee, missing-session behavior under admin layout, and any
leftover HTML-as-JSON path.

## Files Reviewed

- `frontend-next/app/(admin)/admin/users/page.tsx`        → `/api/users?${query}`
- `frontend-next/app/(admin)/admin/ai-models/page.tsx`    → `/api/admin/ai-models`
- `frontend-next/app/(admin)/admin/ai-providers/page.tsx` → `/api/admin/ai-providers`
- `frontend-next/app/(admin)/admin/layout.tsx`            → `requireRole(["admin"])`
- `frontend-next/src/lib/api/server.ts`                   → `requireApiClient` / `getServerApiClient`
- `frontend-next/src/lib/auth/server.ts`                  → `getSession` / `requireUser` / `requireRole`
- `frontend-next/src/lib/auth/session.ts`                 → session JWT + cookie config
- `frontend-next/app/api/admin/{users,ai-models,ai-providers}/route.ts`  → BFF routes
- Client hooks: `src/features/admin/hooks/{use-admin-users,use-ai-models,use-ai-providers}.ts`

## Verdict

**NO BLOCKERS.**

## Checks

### 1. requireApiClient backend paths match BFF routes — OK

| Page             | Direct backend path (page) | BFF route backend path                     |
|------------------|----------------------------|--------------------------------------------|
| users            | `/api/users?${query}`      | `/api/users?${searchParams}`               |
| ai-models        | `/api/admin/ai-models`     | `/api/admin/ai-models` (+`?provider_id=`)  |
| ai-providers     | `/api/admin/ai-providers`  | `/api/admin/ai-providers`                  |

Backend routes verified present:
- `backend/src/users/user_controller.py` → `prefix="/api/users"`, GET list gated `admin_only`
- `backend/src/admin/ai_providers_admin_controller.py` → `prefix="/api/admin"`,
  router-level `Depends(RoleChecker([ADMIN]))`, exposes `/ai-models` and `/ai-providers`

### 2. Tokens remain server-only — OK

- `requireApiClient` adds `Authorization: Bearer ${session.idToken}` server-side
  (`src/lib/api/server.ts`).
- `import "server-only"` enforced in `server.ts` and `auth/server.ts`.
- `session.idToken` lives only inside httpOnly JWT cookie (`sessionCookie` →
  `httpOnly: true`, `sameSite: "lax"`).
- Pages pass only typed data props (`AiModel[]`, `AiProvider[]`,
  `AdminUsersResponse`) to client components — no idToken.
- Client hooks call BFF via relative `/api/admin/...` (same-origin cookies),
  never receive or send a bearer token. Grep for `idToken|accessToken|Bearer`
  across `src/features/admin/**` returns nothing.

### 3. Missing session behavior under admin layout — OK

- `AdminLayout` calls `await requireRole(["admin"])` → `requireUser()` →
  `getSession()`. No session → `redirect("/login")`. Non-admin → `redirect("/")`.
- App Router renders the layout before the page children, so when session is
  missing/invalid the redirect fires before the page's `requireApiClient` call
  runs. Page-level `requireApiClient` 401 path is therefore an unreachable
  safety net, not a behavior surface.
- All three pages wrap the fetch in `try/catch` and fall back to empty initial
  data (`{ items: [] }` / `[]`), so a backend error renders the shell with an
  empty table rather than a hard error page.

### 4. No HTML-as-JSON path remains — OK

- All server fetches use `client.get<T>(...)` returning typed JSON.
- Grep across `frontend-next/app/(admin)/**/*.tsx` for
  `.text()|innerHTML|dangerouslySetInnerHTML|text/html` → no matches.
- Client hooks consume `response.json()` only; no string-HTML parsing.

## Non-blocking Observations (do not block)

1. `users` page query builder drops non-string searchParams values; BFF passes
   `searchParams` verbatim. In practice all user filters are single-valued
   (`email`, `includeDeleted`, `limit`, `offset`) so behavior matches.
2. `ai-models` server page ignores any `providerId` SSR query param (unlike the
   BFF which forwards `provider_id`). Client hook re-filters post-hydration via
   `useAiModels(providerFilter)`, so initial SSR shows all models then narrows.
   Consistent with the `initial` SSR contract.
3. AI registry pages are hidden in the subnav behind the `aiProviderRegistryAdmin`
   feature flag, but the pages/layout do not re-check the flag. Admin-only pages,
   no security impact; matches Angular behavior.

## Recommendation

Ship as-is. No code edits required from this review.
