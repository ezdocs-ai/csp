# Invalid `error.status` outside 200..599 — Audit

Scope: `frontend-next/app/api/{workspaces,images}/route.ts`, `src/lib/api/{client,errors,server}.ts`, `src/lib/auth/{server,session}.ts`. READ-ONLY. No edits applied.

## Symptom
After ~5 min, route handler returns response with status outside HTTP 200..599 range (observed: 0).

## 5-7 plausible causes

1. **`ApiError.network()` hardcodes `status: 0`** (`src/lib/api/errors.ts:75`). Not in HTTP range.
2. **Route catch blocks trust any numeric `error.status`**: pattern `typeof error.status === "number" ? error.status : 500` accepts `0`, bypassing 500 fallback. Repeated in 50+ handlers (workspaces GET/POST L11/L27, images GET/POST L11/L30, every admin route).
3. **No timeout `signal` on JSON `request()`** (`client.ts:60-64`). Only `workbench/render` route passes `AbortSignal.timeout(10m)` to `postBlob`. Long backend op (image generation) hangs until socket dies.
4. **Missing `export const maxDuration`** on long-op routes. Only `app/api/workbench/render/route.ts` declares `maxDuration = 600`. `images` POST has none → platform default applies.
5. **Upstream timeout (Cloud Run LB / FastAPI / proxy) ~300s** drops connection → `fetchImpl` rejects → `ApiError.network()` → status 0. Matches "~5 min".
6. TCP idle/keepalive drop on reverse proxy after 5 min → same path as #5.
7. Session `idToken` Google OAuth expiry (1h) vs `SESSION_TTL_SECONDS = 15*60` — would surface as backend 401, not status 0. Less likely for this symptom.

## Distilled top causes (code evidence)

### #1 — Proximate: `ApiError.network()` status 0 + permissive route status check
- `errors.ts:72-81` `static network(cause)` → `new ApiError({ status: 0, ... })`.
- `errors.ts:84-90` `errorKind(status)` treats `0` as `"network"` kind.
- Route handlers (e.g. `workspaces/route.ts:11`, `images/route.ts:11`):
  ```ts
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
  return NextResponse.json({ error: ... }, { status });
  ```
  `0` is `typeof === "number"` → forwarded to `NextResponse.json({...}, { status: 0 })`.
- `status: 0` is invalid HTTP. Next/undici `Response` either throws `RangeError: Invalid status code 0` (Node ≥18 enforces 100..999 exclusive of 0) or coerces — either way client sees malformed/abnormal status outside 200..599.

### #2 — Trigger: no per-request timeout + no `maxDuration` on long routes
- `client.ts:52-68` `request()` calls `fetchImpl(url, { ...init, method, headers, body })` with no default `signal`.
- Only `app/api/workbench/render/route.ts:6` declares `maxDuration = 600`; only its POST passes `AbortSignal.timeout(10*60*1000)`.
- `images/route.ts` POST (image generation — long backend op) has neither. Wall-time matches Cloud Run / LB / Vercel Pro default ~300s → fetch rejection → cause #1.

Next.js reference (Context7 `/vercel/next.js`): `NextResponse.json(body, { status })` requires a valid HTTP status; route handlers accept `export const maxDuration` to extend platform function timeout; BFF guidance wraps handler body in try/catch returning 500 on unknown errors.

## Minimal shared fix (do NOT apply — audit only)

Centralize status normalization in `src/lib/api/errors.ts`:

```ts
export function statusFromError(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number" && status >= 200 && status <= 599) return status;
  }
  return 500;
}
```

Option A (smallest diff): replace inline status line in every route handler with `const status = statusFromError(error);`.

Option B (semantic, recommended): change `ApiError.network()` to emit `status: 502` ("Bad Gateway" — upstream network failure). Update `errorKind()`: key `"network"` off `code === "NETWORK_ERROR"` rather than `status === 0`, since 502 otherwise falls into `"http"`. Still add `statusFromError` as defense-in-depth for route handlers.

Optional (addresses trigger): add default `signal` to `request()` in `client.ts` (e.g. `AbortSignal.timeout(290_000)` — just under Cloud Run 5 min) with per-call override via `init.signal`. Add `export const maxDuration = 600;` to long-op routes (`images`, `upscale`, `video`, `workflows/[id]/run`, etc.) mirroring `workbench/render`.

## Tests to add (audit only — not created)

`src/lib/api/__tests__/errors.test.ts` (dir does not exist yet — no current tests for lib/api):

1. `ApiError.network(new Error("x"))` → `.status` is within 200..599 (assert after Option B: === 502; before fix: === 0 — test documents regression).
2. `ApiError.fromResponse(new Response(null, { status: 503, statusText: "Service Unavailable" }))` → `.status === 503`, `.kind === "http"`.
3. `statusFromError({ status: 0 })` → 500.
4. `statusFromError({ status: 700 })` → 500.
5. `statusFromError({ status: NaN })` → 500.
6. `statusFromError({ status: 401 })` → 401.
7. `statusFromError({ status: 599 })` → 599.
8. `statusFromError(new Error("no status"))` → 500.
9. `statusFromError(undefined)` → 500.

`app/api/images/route.test.ts` (handler-level): inject `fetchImpl` stub via DI in `createApiClient` that rejects → POST response status within 200..599 (currently 0 — failing). Requires minor refactor so route's `requireApiClient` can be mocked OR use `createApiClient({ fetchImpl })` injection that already exists in `client.ts:50`.

## Key files
- `frontend-next/src/lib/api/errors.ts` — `ApiError.network` status 0 (L72-81), `errorKind` (L84-90).
- `frontend-next/src/lib/api/client.ts` — `request()` no signal (L52-68), `getBlob`/`postBlob` (L76-100).
- `frontend-next/app/api/workspaces/route.ts` — status passthrough L11, L27.
- `frontend-next/app/api/images/route.ts` — status passthrough L11, L30; no `maxDuration`, no `signal`.
- `frontend-next/app/api/workbench/render/route.ts` — reference pattern (`maxDuration = 600`, `AbortSignal.timeout(10*60*1000)`).
- `frontend-next/next.config.ts` — `output: "standalone"` (self-host); platform timeouts still apply via upstream proxy.
