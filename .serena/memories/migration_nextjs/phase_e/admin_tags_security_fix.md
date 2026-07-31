# Phase E — Admin Tags/Security P0 (Next.js migration)

Scope owned: `app/api/admin/tags/**`, `app/api/admin/{ai-models,ai-providers}/**`, `src/features/admin/components/tag-manager.tsx`.
NOT touched: templates, media-gallery, source-assets, admin layout.

## Backend contract (source of truth)
`backend/src/tags/dto/tags_dto.py` + `backend/src/tags/tags_controller.py`:
- search `POST /api/tags/search` (`TagSearchDto`): `workspace_id:int|None` (non-admin forbidden w/o it), `search`, `user_id`, `limit`,`offset`.
- create `POST /api/tags` (`TagCreateDto`): `workspace_id:int` REQUIRED, `name`, `color?`.
- update `PUT /api/tags/{id}` (`TagUpdateDto`): `name?`,`color?` — backend resolves workspace from the tag itself, NO workspace_id sent.
- delete `DELETE /api/tags/{id}`: no body.
- bulk-assign `POST /api/tags/bulk-assign` (`BulkAssignTagsDto`): `workspace_id:int`, `item_ids:int[]`, `item_type:str` ("media_item"|"source_asset"), `tag_names:str[]`.
Authorization enforced server-side via `WorkspaceAuth.authorize`.

## Changes made
1. Tag workspace scoping → active workspace. `tag-manager.tsx` now uses `useWorkspace()` (`@/src/lib/workspace`) `activeWorkspace`; manual raw "Workspace ID" input field removed. Create/search/bulk-assign forward `workspace_id: Number(activeWorkspace.id)`. Buttons disabled when no active workspace.
2. Bulk-assign contract BUG FIXED: was sending `media_item_ids`+`tag_ids` (422). Now sends `item_ids`+`item_type`(default "media_item")+`tag_names` (string[]). "Tag IDs" field → "Tag names (comma-separated)".
3. Payload logic centralized in pure `src/features/admin/tags-payload.ts` (`tagSearchPayload`, `tagCreatePayload`, `tagBulkAssignPayload`) — snake_case keys + bulk-assign mapping. Used by tag-manager.
4. CSRF verification added to all tag MUTATIONS:
   - `app/api/admin/tags/route.ts` POST → `verifyCsrf` gate (after requireRole).
   - `app/api/admin/tags/[id]/route.ts` PATCH + DELETE → `verifyCsrf` gate.
   - Client (`tag-manager.tsx`) sends `x-csrf-token` header (reads `csp_csrf` cookie via `csrfToken()` helper, same pattern as brand-guideline-upload/workspace dialogs) on search/create/bulk-assign/PATCH/DELETE.
5. `requireRole(["admin"])` added to AI GET routes (payloads unchanged):
   - `ai-models/route.ts` GET, `ai-models/[id]/route.ts` GET
   - `ai-providers/route.ts` GET, `ai-providers/[id]/route.ts` GET
   (AI routes already had CSRF on mutations; tags routes already had requireRole.)

## Tests
`src/features/admin/tags-payload.test.ts` (bun:test) — 3 tests / 6 expects, all pass:
- search forwards `workspace_id`, omits empty search.
- create forwards `workspace_id`, omits empty color.
- bulk-assign maps to `item_ids`/`item_type`/`tag_names`.
Run: `cd frontend-next && bun test src/features/admin/tags-payload.test.ts`.

## Validation
- diagnostics: all changed files clean except pre-existing Tailwind `[var(--...)]` style warnings (codebase-wide convention, unchanged from original) in tag-manager.tsx — left in scope.
- eslint (`bunx eslint` on all 9 files): exit 0, no output.

## Notes / follow-ups
- BFF proxies forward client workspace_id; backend `WorkspaceAuth` is the trust boundary (anti-spoof). No server-side workspace injection needed.
- requireRole uses `redirect()` (codebase pattern) → non-admin API hits return redirect, not JSON 403. Consistent with existing tags routes.
- No frontend workspace context exists server-side; active workspace is client-resolved (url/localStorage/default).
