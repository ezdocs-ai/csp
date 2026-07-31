# Phase E — Admin Source Assets Parity Fix (IMPLEMENTED 2026-07-29)

Supersedes blocker B4 in `migration_nextjs/phase_e/admin_audit`. Write set S3 delivered.

## Contract verdict (evidenced)

Backend `backend/src/source_assets/source_asset_controller.py` exposes for `/api/source_assets/`:
- `POST /upload` (USER+ADMIN) — Form: `file, workspaceId, scope?, assetType?, aspectRatio?, upscaleFactor?`
- `POST /search` (USER+ADMIN) — `SourceAssetSearchDto`: `{limit, offset, mime_type?, user_email?(admin), scope?(admin), asset_type?(admin), original_filename?(admin), workspace_id?, tags?}`. Non-admin → admin filters cleared + target_user_id forced to self. Admin → platform-wide unless filtered.
- `GET /{id}` (USER+ADMIN), `DELETE /{id}` (ADMIN ONLY), `POST /convert-to-png`, `GET /vto-assets`.
- **NO update/PATCH/PUT endpoint.** Angular `updateSourceAsset` PUTs to non-existent route (broken in Angular too). Next `app/api/source-assets/[id]/route.ts` PATCH already returns 501.

→ "edit only fields backend actually supports" = **zero edit fields** = no edit UI. Edit action intentionally omitted in Next admin table.

## Evidenced contract blocker → BFF touched

`app/api/source-assets/route.ts` GET previously forwarded only `mime_type` (from `type`) + `original_filename` (from `search`). Could not carry admin `scope`/`asset_type`/`workspace_id`/`user_email` filters → admin browse controls impossible. **Extended GET additively** to read + forward `scope`, `asset_type`, `workspace_id`, `user_email`. Response shape + `type`/`search`/`page`/`pageSize` preserved → shared `asset-picker.tsx` (`/api/source-assets?type=`) untouched + still working.

## Files changed (disjoint write set S3)

1. `frontend-next/src/features/source-assets/source-asset-filters.ts` (NEW, pure) — `AssetScope`/`AssetType` const-enums (mirror backend enums), `ASSET_SCOPE_OPTIONS`/`ASSET_TYPE_OPTIONS`, `buildSourceAssetQuery(filters,page,pageSize)`, `buildUploadFields(scope,assetType)`, `nextSortDirection`. Reuses `toQuery`/`pageOffset`/`SortDirection` from `admin-controls`.
2. `frontend-next/src/features/source-assets/source-asset-filters.test.ts` (NEW) — 8 tests, query/payload/sort builders. **All pass.**
3. `frontend-next/src/features/source-assets/types.ts` — `SourceAsset` extended additively: `originalFilename?, mimeType?, scope?, assetType?, gcsUri?, workspaceId?, userId?`. Existing fields preserved (picker/studios unaffected).
4. `frontend-next/app/api/source-assets/route.ts` — GET additive admin-filter forwarding (see above). POST upload untouched.
5. `frontend-next/src/features/source-assets/components/source-asset-admin.tsx` — rewritten as platform-wide admin browse container: Scope + Type selects, debounced Search, Clear + Search, table via `<SourceAssetList>`, `<Paginator>` `[10,25,100]`, client sort (name/type/created), Create-asset `<Dialog>` (file + scope + assetType → `useSourceAssets().upload` with active workspace), `<ConfirmDialog>` for delete (replaces `window.confirm`). Uses `useWorkspace()` for upload `workspaceId`.
6. `frontend-next/src/features/source-assets/components/source-asset-list.tsx` — presentational table: Thumbnail/Filename/Type(badge)/Created/Actions + `SortableHead`. Pluggable `actions` prop. No edit column (backend unsupported).
7. `frontend-next/src/features/source-assets/index.ts` — re-exports filters module.

## Parity delivered vs Angular `source-assets-management.component`

| Angular feature | Next status |
|---|---|
| Platform-wide browse (not workspace-scoped) | ✓ admin `/search` returns all for admin role |
| Filter by Scope | ✓ select |
| Filter by Type | ✓ select |
| Clear + Search buttons | ✓ |
| Thumbnail column | ✓ |
| Filename column (sortable) | ✓ |
| assetType chip column (sortable) | ✓ Badge |
| Created column (sortable) | ✓ |
| Actions: edit + delete | delete only (edit backend-unsupported) |
| Paginator `[10,25,100]` showFirstLast | ✓ Paginator |
| Create Asset → upload form modal | ✓ Dialog (scope default SYSTEM, assetType default GENERIC_IMAGE) |
| ConfirmationDialog for delete | ✓ ConfirmDialog (was window.confirm) |

## Respected constraints

- **Active workspace semantics**: browse platform-wide for admin (matches Angular + backend admin `/search`); upload uses `activeWorkspace.id` (backend `/upload` requires `workspaceId`).
- **Backend authorization**: page gated by `requireRole(["admin"])` (layout + page.tsx); DELETE admin-only enforced server-side (`RoleChecker(ADMIN)`); CSRF `csp_csrf` cookie + `x-csrf-token` on delete + upload.
- **Untouched** (per task scope): `asset-picker.tsx`, admin layout/subnav, templates, tags, media-gallery. Upload BFF POST preserved.
- Edit omitted deliberately — adding UI for a 501 endpoint would be worse than omitting.

## Validation run

- `bun test src/features/source-assets` → 8/8 pass.
- `bun test src` → 164/164 pass (no regressions).
- `npx eslint src/features/source-assets/ app/api/source-assets/` → clean.
- `diagnostics` on all 7 changed files → 0 TS errors (only pre-existing Tailwind bracket-style suggestions matching codebase convention).
- Containerized `pre-commit run --files <7 files>` → addlicense Passed; gts/black out of scope (frontend-next, not Angular).

## Backend coverage note

Changes are frontend-only (TS/React). Backend `src/` untouched → 80% pytest coverage rule not affected.

## Not verified

- Live browser run (code-only). BFF admin-filter forwarding inferred from `SourceAssetSearchDto` field names + controller admin-branch logic; backend clears admin filters for non-admins so forwarding is safe for any caller.
- Backend enforcing `workspace_id`/`user_email` on `/search` for admin (controller resolves user_email → target_user_id; workspace_id passed through to repo).
