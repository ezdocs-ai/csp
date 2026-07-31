# Invalid `error.status` — Final Review (READ-ONLY)

**Scope:** `frontend-next/src/lib/api/{errors.ts, client.ts, errors.test.ts}` + observed route consumers. READ-ONLY. No edits.
**Date:** 2026-07-29. Prior audits: `migration_nextjs/runtime/invalid_status_audit`, `migration_nextjs/runtime/route_error_status_audit`.
**Verdict: NO BLOCKERS.** Ship.

## Acceptance criteria — all PASS

### 1. `ApiError.network` yields valid HTTP status — PASS
- `errors.ts:78` hardcodes `status: 502` ("Bad Gateway"). 502 ∈ [200,599]. Replaces prior `status: 0`.
- Pinned by `errors.test.ts:10` (`toBe(502)`) and range assert L20-21 (`>=200 && <=599`).
- Route consumers verified still inlined (terminal grep, NOT the lib grep tool which missed `.ts`): `app/api/{images,workspaces}/route.ts` use `typeof error.status === "number" ? error.status : 500`. With `network()` now emitting 502, ternary forwards 502 → valid `NextResponse.json` status. Proximate cause from prior audit (#1) resolved.

### 2. `kind` remains `"network"` — PASS
- `errorKind` (`errors.ts:87-93`) now keys `"network"` off `code === "NETWORK_ERROR"` (L88), NOT `status === 0`.
- `ApiError.network` sets `code: "NETWORK_ERROR"` (L80) → kind = `"network"` despite status 502.
- Pinned by `errors.test.ts:13` and L22.

### 3. Logging exposes no auth headers/tokens — PASS
- `client.ts:63-68` logs ONLY `{ method, path, baseUrl, error: {name, message} }`. No `headers`, no `Authorization`, no `Cookie`, no `getHeaders()` output.
- `error` field destructured to `name`/`message` only — cause object NOT serialized wholesale.
- Catch block (L62) fires only on `fetchImpl` rejection (true network failure); response-derived errors flow through `fromResponse` (L71) and are thrown WITHOUT logging.
- `baseUrl` from env (`defaultBaseUrl`) — no embedded creds. Fetch TypeError messages don't echo URL. Safe.
- `getBlob`/`postBlob` (L89-92, L102-105) catch blocks do NOT log at all — no leak surface there.

### 4. No regression for response-derived errors — PASS
- `fromResponse` (`errors.ts:55-70`) UNCHANGED: body parse → `detail`/`code`/`details`/`message` → `response.status` passed through verbatim.
- `errorKind` change (status→code keying) only affects `code === "NETWORK_ERROR"`. `fromResponse` only sets `code` when backend returns `{detail: "<string>"}` — a backend HTTP error body string-equal to `"NETWORK_ERROR"` would mis-tag as `"network"`. Negligible: backend doesn't emit that token for HTTP errors; status 0 path (old branch) was never reachable from `fromResponse` anyway (0 is not a valid HTTP status).
- `getBlob`/`postBlob` re-throw path `if (error instanceof ApiError) throw error` preserves response-derived `ApiError` unchanged.

## Non-blocker observations (out of scope, do not block ship)
1. Route handlers still use inline permissive ternary (`typeof === "number"`). Defense-in-depth `statusFromError`/`errorResponseStatus` helper from prior audit NOT added. Not a blocker because the ONLY source of out-of-range status was `ApiError.network` (now 502); all other `ApiError` instances carry real HTTP statuses from `fromResponse`. Latent passthrough of a hypothetical `{status: 999}` from non-ApiError throwers remains — pre-existing, not introduced here.
2. `errors.test.ts` has no `fromResponse` regression test (audit rec #2). Code review confirms no regression; test gap only.
3. `getBlob`/`postBlob` catch blocks skip the `console.error` log that `request()` emits — inconsistency, not security issue.
4. Trigger-side gaps from prior audit (no default `signal` on `request()`, missing `export const maxDuration` on long-op routes other than `workbench/render`) NOT addressed here. Separate scope; fix under that audit.

## Files
- `frontend-next/src/lib/api/errors.ts` — fix L72-84, errorKind L87-93.
- `frontend-next/src/lib/api/client.ts` — logging L63-68 (safe), blob paths L82-106.
- `frontend-next/src/lib/api/errors.test.ts` — pins status 502, kind network, range.
- Consumers (unchanged): `app/api/images/route.ts:11,30`, `app/api/workspaces/route.ts:11,27`, + ~43 similar inline ternaries.

## Observed backend recovery
After fix deployed, `ApiError.network` (upstream drop / Cloud Run ~300s timeout path) surfaces to BFF clients as HTTP 502, not status 0. Next/undici no longer rejects on `NextResponse.json({status:0})`. Client receives well-formed 502 → retry/backoff paths engage correctly. Symptom from `invalid_status_audit` (status 0 after ~5 min) resolved at the error-shape layer.
