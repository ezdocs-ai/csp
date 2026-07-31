# Visual Route + Unauth 401 Final Review (read-only)

Date: 2026-07-30
Scope: app/visual/page.tsx, app/visual/_interactive-specimens.tsx, src/components/ui/toast.tsx, src/lib/api/server.ts, tests/e2e/smoke.spec.ts, src/lib/auth/__tests__/session.test.ts

## Verdict: NO BLOCKERS

### 1. Server→client function props in visual route — CLEAN
- `app/visual/page.tsx` is async Server Component.
- Props passed to UI primitives are strings, booleans, JSX elements, arrays of plain objects (`{label,href,active}`). No function refs cross boundary.
- `<InteractiveFeedbackSpecimens />` and `<DialogSpecimen />` (from `./_interactive-specimens`, `"use client"`) take ZERO props from server. Handlers (`onClose`, `onDismiss`) defined client-side inside specimens, not received from server.
- `EmptyState actions={<Button>Upload asset</Button>}`: JSX element w/o function props. Allowed in RSC payload.

### 2. Toast client directive — CORRECT
- `src/components/ui/toast.tsx` line 4: `"use client";`. Required because component binds `onClick={() => onDismiss(id)}`. Directive present, correct placement (before imports).

### 3. no-session typed 401 — CLEAN, no network/backend conflation
- `requireApiClient()` throws `ApiError{status:401, statusText:"Unauthorized", code:"NO_SESSION", message:"Unauthorized: no active session"}` ONLY when `getServerApiClient()` returns null (i.e. `getSession()` falsy). Thrown before any backend fetch.
- Network path (`ApiError.network` → status 502, code "NETWORK_ERROR", kind "network") untouched.
- Backend path (`ApiError.fromResponse` → preserves upstream status/statusText/detail-derived code) untouched.
- Backend-returned 401 distinct from NO_SESSION: code = backend `detail` string or undefined, never "NO_SESSION". No conflation. `errorKind()` maps both to kind "unauthorized" but code field distinguishes.

### 4. Tamper test actually mutates decoded signature — VALID
- `session.test.ts` "session rejects tampered signature":
  - `token.split(".")` → 3 parts. `signature` = base64url signature segment.
  - `replacement = signature.startsWith("A") ? "B" : "A"` → guaranteed != first char in all cases.
  - Tampered sig = `replacement + signature.slice(1)`. First base64url char swapped to a char decoding to a different 6-bit value (A=0, B=1) → first decoded HMAC byte changes.
  - Both "A" and "B" valid base64url alphabet → no malformed-encoding short-circuit; jose `jwtVerify` fails on genuine HMAC mismatch, not on parse error.
  - `verifySession` wraps `jwtVerify` in try/catch → returns null. Asserts null. Real cryptographic rejection, not a tautology.
- Companion tests: round-trip, expired (-1 exp). Coverage sound.

### smoke.spec.ts (tangential)
- Unauth liveness always runs (health 200, /api/workspaces 401, /login 200, root→/login redirect). Authenticated cutover block `test.skip(!hasStorageState)`; real Google login never faked, storage state injected via E2E_STORAGE_STATE. No blockers for review items.

## Open (non-blocking) observations
- None material to the four review items.
