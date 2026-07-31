# Phase E — Admin Media Gallery Security Fix (Next.js migration)

Scope owned: `app/api/admin/media-gallery/**`, `src/features/admin/components/media-gallery-admin.tsx`, focused tests (`src/features/admin/__tests__/media-query.test.ts`).
NOT touched: tags route/component (already CSRF-protected in `mem:migration_nextjs/phase_e/admin_tags_security_fix`), Angular media-gallery, backend.

## Backend contract (source of truth)
`backend/src/galleries/dto/gallery_search_dto.py` (`GallerySearchDto`, extends `BaseSearchDto`/`BaseDto`):
- `BaseDto` sets `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, ...)` → backend accepts BOTH snake_case (field name) AND camelCase (alias). Angular sends camelCase; Next route sends snake_case. Both valid. No contract bug.
- `include_deleted: bool = False` (snake_case). Consumed at `unified_gallery_repository.py:57` (`if not search_dto.include_deleted: filter deleted_at IS NULL`).
- Mutations: `POST /api/gallery/bulk-delete` (`BulkDeleteDto`: `items:[{id,type}]`, `workspace_id:int`), `POST /api/gallery/items/{id}/restore?item_type=...`, `POST /api/admin/cleanup-stuck-jobs`. BFF POST routes these via an `action` discriminator (delete/restore/cleanup).

## Changes made
1. CSRF verification added to media-gallery MUTATIONS only (reads/GET unchanged), mirroring the tags-route + tag-manager pattern:
   - `app/api/admin/media-gallery/route.ts` POST → `verifyCsrf(cookie vs x-csrf-token)` gate immediately after `requireRole(["admin"])`; failure → 403 JSON. GET untouched.
   - Client (`media-gallery-admin.tsx`) `action()` POST now sends `"x-csrf-token": csrfToken()` header. Added module-level `csrfToken()` helper reading the non-httpOnly `csp_csrf` cookie (identical to `tag-manager.tsx`).
2. No tag mutation exists in media-gallery scope (Tags here is a read-only MultiSelect filter); delete/restore/cleanup are the only mutations covered.
3. include-deleted: VERIFIED, intentionally NOT exposed/forwarded. Backend supports `include_deleted`, but this view has no toggle control (only a `ponytail:` comment). Per task gate (expose only if backend supports AND UI has a control), condition unmet → route keeps hardcoded `include_deleted: true` so soft-deleted items + their Restore button stay visible. Refined the ponytail comment to record the verified outcome + upgrade path (add checkbox + forward param only when a control exists).

## What was NOT changed (preserved)
- GET body shape (snake_case keys, `include_deleted: true`, workspace_id omitted).
- Filters + table UI (search/email/status/type/model/tags/start/end) unchanged.
- `buildMediaQuery` pure serializer unchanged.

## Tests
`src/features/admin/__tests__/media-query.test.ts` (bun:test) — 3 tests, all pass (GET query serializer; unaffected by CSRF change). Run: `cd frontend-next && bun test src/features/admin`.
No new test added: change is mechanical wiring (CSRF gate + header) identical to the established tags pattern; frontend-next has NO route-handler test infra (all tests are pure-function unit tests), so a route test would require building mock infrastructure that doesn't exist in this repo = overengineering.

## Validation
- diagnostics: `route.ts` clean (0 errors/warnings); `media-gallery-admin.tsx` only pre-existing codebase-wide Tailwind `[var(--...)]` style nits (untouched lines) — left in scope.
- `bun test src/features/admin src/lib/auth`: 30 pass / 1 fail. The 1 fail is PRE-EXISTING and UNRELATED: `session.test.ts` "session rejects tampered signature" (jose last-char base64url flip flakiness) — `session.ts`/test not touched by this change.

## Notes / follow-ups
- Read path needs no CSRF (idempotent GET); consistent with tags GET.
- include-deleted toggle deferred to when a UI control is added (out of current scope, "no redesign").
- Angular default `includeDeleted=false` differs from Next `true`, but Next intentionally shows soft-deleted so the Restore action is reachable — confirmed correct admin-management behavior.
