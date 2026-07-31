# READ-ONLY audit — `GET /api/workspaces` returns 500 after session expiry

Date: 2026-07-30. Scope: `csp/frontend-next`. No files edited.

## Reported symptom
After the 15-min JWT session expires, `GET /api/workspaces` responds **500** instead of **401**. Backend is never contacted (logs show no upstream `/api/workspaces` call).

## Call chain (proven by reading source)
1. `src/lib/auth/session.ts:21` → `SESSION_TTL_SECONDS = 15 * 60`. JWT expires.
2. `session.ts:50-58` `verifySession` → `jwtVerify` throws → `catch {}` returns `null`.
3. `src/lib/auth/server.ts:24-27` `getSession` → returns `null`.
4. `src/lib/api/server.ts:22-29` `getServerApiClient` → `if (!session) return null`.
5. `src/lib/api/server.ts:31-34` `requireApiClient` → throws `new Error("Unauthorized: no active session")`. **PLAIN `Error`, NO `.status` field.**
6. Route catch, e.g. `app/api/workspaces/route.ts:10-13`:
   ```ts
   const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
   ```
   Plain `Error` has no `.status` → ternary short-circuits to `500`. `error.message` ("Unauthorized: no active session") leaks in the body but HTTP status is wrong.

**Backend never called.** This is purely a BFF (Next route) masking bug.

## Scope of impact
`requireApiClient` is invoked by **45 route handlers** under `app/api/**` (catalogued in `mem:migration_nextjs/runtime/route_error_status_audit`). Every non-admin authenticated route that does NOT call `requireRole` first exhibits this bug on session expiry:
- `workspaces`, `workspaces/[id]`, `workspaces/[id]/invites`
- `images`, `images/[id]`, `audio`, `gallery/*`, `video*`, `vto*`, `upscale*`, `workflows*`, `workbench/render`, `gemini/rewrite-prompt`, `options/video-generation`, `brand-guidelines*`, `source-assets*`, `admin/templates*`, `admin/users*`, `admin/media-gallery`.

Admin routes that call `requireRole` BEFORE `requireApiClient` escape: `requireRole → requireUser → redirect("/login")` (not a throw) on expired session, so they never reach `requireApiClient`.

## Why 5 candidate causes distilled to 1
Considered: (a) backend returning 500, (b) `BACKEND_URL` misconfigured, (c) `ApiError.network` status 0 (already fixed in `mem:migration_nextjs/runtime/invalid_status_fix`), (d) CSRF middleware, (e) `requireApiClient` throwing plain `Error`, (f) next/headers `cookies()` throwing.
Rejected: (a)(b) — backend never contacted (no upstream log). (c) — already 502. (d) — GET workspaces doesn't gate on CSRF. (f) — `cookies()` returns undefined, doesn't throw.
**Confirmed: (e)** — `requireApiClient` throws plain `Error`, route catch masks to 500. Source-read at `src/lib/api/server.ts:31-34` and `app/api/workspaces/route.ts:10-13`.

## Minimal shared 401 fix (proposed — NOT applied)
Change ONE line in `src/lib/api/server.ts` so the sentinel carries a `.status`. All 45 call-sites fix automatically; no route edits; no central helper; no status-clamp codemod.

```ts
// src/lib/api/server.ts
import { createApiClient, type ApiClient } from "./client";
import { ApiError } from "./errors";

export async function requireApiClient(): Promise<ApiClient> {
  const client = await getServerApiClient();
  if (!client) throw new ApiError({ status: 401, statusText: "Unauthorized", code: "NO_SESSION", message: "Unauthorized: no active session" });
  return client;
}
```

### Why this is minimal + safe + shared
- **Single source.** All 45 routes that forward `error.status` get 401 automatically. `ApiError` already exposes `readonly status: number` (`src/lib/api/errors.ts:36-53`), and the existing route ternary already forwards `ApiError.status` correctly.
- **Does NOT change valid backend statuses.** `ApiError.fromResponse` (errors.ts:55-70) still produces the real upstream status (401/403/404/4xx/5xx); network errors still 502 (`ApiError.network`); CSRF/400-validation guards in routes untouched.
- **Only the "no active session" sentinel changes:** 500 → 401.
- **No new file, no new dependency, no new abstraction.** Reuses existing `ApiError` class.

### Explicitly NOT in scope (would change valid statuses — user forbade)
The broader central `errorResponseStatus(error)` helper + clamp codemod proposed in `mem:migration_nextjs/runtime/route_error_status_audit`. That helper re-maps out-of-range/non-integer/synthetic statuses and would alter current behavior for edge cases. Out of scope for this audit.

## Proposed tests (NOT applied)
`src/lib/api/server.ts` imports `"server-only"` and `getSession()` (calls `next/headers` `cookies()`). Mock both with `bun:test` `mock.module`. Place test next to source: `src/lib/api/server.test.ts` (matches existing `src/lib/api/errors.test.ts` pattern, runs under `bun test src`).

```ts
/** Copyright 2026 Google LLC — Apache-2.0 */
import { afterEach, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("../auth/server", () => ({ getSession: () => null }));

const { requireApiClient } = await import("./server");
const { ApiError } = await import("./errors");

test("requireApiClient throws ApiError status 401 when session is null", async () => {
  try {
    await requireApiClient();
    throw new Error("expected throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).kind).toBe("unauthorized");
    expect((error as ApiError).code).toBe("NO_SESSION");
  }
});

afterEach(() => mock.clearAllMocks());
```

Optional regression (route-level): a single assertion that the route catch forwards `ApiError.status === 401` to `NextResponse.json(..., { status: 401 })` for `/api/workspaces`. Requires mocking `requireApiClient` to throw an `ApiError(401)` and asserting response.status === 401 (not 500). Skipped unless requested — the unit test above pins the shared sentinel; route ternary is already covered by read-only evidence.

## Validation plan (post-fix, when applied)
1. `cd frontend-next && bun test src/lib/api` — new test passes, existing 275 pass.
2. Manual: expire session (clear `csp_session` cookie) → `curl -i /api/workspaces` → expect `HTTP/1.1 401` (was 500).
3. Regression: valid session → `/api/workspaces` still 200; backend 403 still forwards as 403; backend down still 502.
4. `bun lint` clean.

## Related
- `mem:migration_nextjs/runtime/route_error_status_audit` — broader audit (item #3 = this bug).
- `mem:migration_nextjs/runtime/invalid_status_fix` — prior fix for `ApiError.network` status 0 → 502 (different bug, same catch-pattern family).
