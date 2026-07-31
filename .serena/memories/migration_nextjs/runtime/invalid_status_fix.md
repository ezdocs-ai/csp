# Runtime fix — invalid NextResponse status after backend outage

Date: 2026-07-29

## Root causes
1. The development backend was hung during Uvicorn reload. Repository-wide pre-commit had reformatted already-modified `backend/src/auth/auth_guard.py`; reload reached `Waiting for application shutdown` and the single dev worker stopped responding. `BACKEND_URL` itself was correct (`localhost:9000`). Restarting only the backend container restored `/openapi.json` to HTTP 200 in 0.48s; options now returns 200 and unauthenticated workspaces returns 401 in ~2ms.
2. Next shared `ApiError.network()` represented fetch failures as `status: 0`. Route handlers accepted any numeric `error.status` and passed 0 to `NextResponse.json`; Fetch/Response requires an HTTP status in 200..599, producing the reported RangeError.

## Changes
- `frontend-next/src/lib/api/errors.ts`
  - network errors now use HTTP 502 / `Bad Gateway`.
  - `kind: "network"` is derived from `code === "NETWORK_ERROR"`, not synthetic status 0.
- `frontend-next/src/lib/api/client.ts`
  - logs backend request method/path/base URL and error name/message on fetch failure; no auth headers, cookies, tokens, or body are logged.
- `frontend-next/src/lib/api/errors.test.ts`
  - regression coverage for valid 502 status and preserved network kind.

## Validation
- Backend container restarted and remains running.
- Backend `/openapi.json`: 200; image options: 200; unauthenticated workspaces: 401.
- Targeted tests: 2 pass.
- Full Next build: pass.
- Next lint: pass.
- Full unit suite: 275 pass, 0 fail, 608 assertions, 43 files.
- Diagnostics: clean for all changed files.
- `git diff --check`: pass.
- Scoped containerized pre-commit: pass.
- Independent review: no blockers (`mem:migration_nextjs/runtime/invalid_status_final_review`).

No cloud actions or commits performed.
