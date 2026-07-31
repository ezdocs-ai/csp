# Route Handler `error.status` Forwarding Audit (frontend-next)

**Scope:** READ-ONLY audit of `csp/frontend-next/app/api/**/route.ts`.
**Date:** 2026-07-29. No files edited.

## TL;DR
- **45 of 54** route handlers forward `error.status` into `NextResponse.json(..., { status })`.
- **No central helper exists.** The same validation ternary is copy-pasted ~50×.
- The current pattern is *guarded* (validates `typeof === "number"`) — so NOT a raw-injection vuln — but it has real latent bugs (see below) and massive duplication.

## The repeated pattern (canonical form)
```ts
} catch (error) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "<fallback>" }, { status });
}
```

## Existing "safe" patterns (local, inconsistent — NOT shared)
9 files declare a **private** helper instead of inlining. Three incompatible signatures:
1. `errorResponse(error, fallback)` — `admin/templates/[id]`, `admin/templates`, `workflows/[id]`
2. `errorResponse(error)` hardcoded msg — `brand-guidelines/[id]`, `brand-guidelines`, `source-assets/[id]`, `source-assets`, `workspaces/[id]`, `workspaces/[id]/invites`
3. `statusOf(error)` arrow returning number only — `workflows/[id]/run`

`src/lib/api/errors.ts` already exports `ApiError` (with `.status`, `.kind`). `src/lib/api/server.ts` `requireApiClient()` throws a **plain `Error("Unauthorized: no active session")` with NO `.status`** → currently mis-mapped to 500 (should be 401).

## Affected files (45)
admin/ai-models/[id], admin/ai-models, admin/ai-providers/[id], admin/ai-providers/[id]/test, admin/ai-providers, admin/dashboard, admin/media-gallery, admin/templates/[id], admin/templates, admin/users/[id], admin/users, audio, brand-guidelines/[id], brand-guidelines, gallery/copy, gallery/delete, gallery/download, gallery/restore, gallery/tag, gemini/rewrite-prompt, images/[id], images, options/video-generation, source-assets/[id], source-assets, upscale/[id], upscale, video/concatenate, video/edit, video/extend, video, vto/[id], vto/assets, vto, workbench/render, workflows/create, workflows/[id]/execute, workflows/[id]/executions, workflows/[id], workflows/[id]/run, workflows/[id]/update, workflows, workspaces/[id]/invites, workspaces/[id], workspaces.

## Latent bugs the duplication masks
1. **`ApiError.network()` sets `status: 0`** → ternary passes `0` straight to `NextResponse` → invalid HTTP status (Next throws / 500 mask). Should map to 502.
2. **Out-of-range / non-error status** (e.g. 200, 204, 599, 999, floats) passes the `typeof === "number"` guard but is semantically wrong for an error response. No clamp to `[400,599]`.
3. **`requireApiClient()` unauth error** → no `.status` → silently becomes 500 not 401.
4. **`workbench/render`** is the only handler using `502` fallback — divergent behavior, no test pinning it.

## Recommended remediation (smallest central fix)
Single new export in **`src/lib/api/errors.ts`** (already the errors module, no new file, no new dep):

```ts
/** ponytail: ceiling = full RFC 7807 problem+json; add when frontend adopts it. */
export function errorResponseStatus(error: unknown): number {
  if (error instanceof ApiError && error.status > 0) return clamp(error.status);
  if (typeof error === "object" && error !== null && "status" in error) {
    const s = (error as { status: unknown }).status;
    if (typeof s === "number" && Number.isFinite(s) && s >= 400 && s <= 599) return s;
  }
  return 500;
}
const clamp = (s: number) => (s >= 400 && s <= 599 ? s : s === 0 ? 502 : 502);
```
- Then mechanical codemod: replace inline ternary + local `errorResponse`/`statusOf` with `errorResponseStatus(error)`.
- Keeps message logic (`error instanceof Error ? error.message : fallback`) in each handler — only status resolution centralizes.
- Net: 1 new function, ~50 call-site shrinks, 9 local helpers deleted.

## Test scope (minimum viable)
No route-level unit tests currently exist (`tests/` has only e2e/fixtures/visual). Add ONE pure unit test next to the helper:
- `tests/unit/errorResponseStatus.test.ts` (or `src/lib/api/errors.test.ts` if a unit dir isn't established):
  - `new ApiError({status:404,...})` → 404
  - `ApiError.network()` (status 0) → 502
  - `{status: 200}` → 500 (out of range)
  - `{status: 999}` → 502 (clamp)
  - `{status: 401.5}` (non-integer) → 500
  - `Error("x")` (no status) → 500
  - `null`/`undefined`/string → 500
- Optional regression: 1 e2e asserting `/api/workbench/render` still returns 502 on upstream failure (pins the lone outlier contract).
- Assert-based self-check inside helper file is acceptable alternative per project convention if no test runner wired for `src/`.

## Not in scope (do NOT touch)
- auth/login, auth/logout, auth/csrf, health, audio/[id], source-assets/upload-url, video/[id] — these 9 routes have no `error.status` forwarding (different shapes or none). Verify before codemod.
- Message/i18n wording, CSRF flow, `ApiError` class shape.
