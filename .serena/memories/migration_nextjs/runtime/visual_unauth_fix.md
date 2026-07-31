# Runtime fix — Visual RSC event handlers and unauthenticated API status

Date: 2026-07-30

## `/visual` 500
Root cause: async Server Component `app/visual/page.tsx` passed inline functions to interactive components (`Dialog.onClose`, `Toast.onDismiss`). Functions are not serializable across the React Server Component boundary. Toast also rendered an `onClick` without declaring a client boundary.

Fix:
- Added `app/visual/_interactive-specimens.tsx` with `"use client"`; Dialog, Toast, and Tooltip specimens plus their handlers are instantiated entirely in this client island.
- `app/visual/page.tsx` now renders `InteractiveFeedbackSpecimens` and `DialogSpecimen` without passing functions.
- Added `"use client"` to shared `src/components/ui/toast.tsx` because it owns a dismiss click handler.

Verified `/visual` returns HTTP 200 and renders in browser without the RSC event-handler exception.

## `/api/workspaces` 500 after session expiry
Root cause: `requireApiClient()` threw a plain Error when `getSession()` returned null. Route handlers defaulted errors without numeric status to 500.

Fix: `src/lib/api/server.ts` now throws typed `ApiError` with status 401, code `NO_SESSION`, and kind `unauthorized`. Upstream backend statuses and network 502 behavior are unchanged.

Added Playwright smoke assertion that unauthenticated `/api/workspaces` returns 401. Browser may show a normal failed-resource console line for the unauthenticated provider request; it is no longer a server error.

## Validation
- Next production build: pass.
- lint: pass.
- unit tests: 279 pass, 0 fail, 614 assertions, 44 files.
- Playwright smoke: 4 pass, 3 authenticated skipped without fresh storage state.
- `/visual`: HTTP 200.
- unauthenticated `/api/workspaces`: HTTP 401.
- scoped containerized pre-commit: pass.
- independent final review: no blockers (`mem:migration_nextjs/runtime/visual_unauth_final_review`).

## Test hardening
The previously flaky session tamper test mutated the last base64url character, whose trailing bits can decode equivalently. It now changes the first signature character, guaranteeing a different decoded HMAC while keeping valid JWT encoding.

No cloud actions or commits performed.
