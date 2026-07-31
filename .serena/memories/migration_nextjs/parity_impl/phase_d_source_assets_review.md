# Phase D — Source Assets BFF + Picker Review (READ-ONLY)

Reviewer scope: `frontend-next/app/api/source-assets/route.ts`, `frontend-next/src/components/media/asset-picker.tsx` vs backend `source_asset_controller.py` + `SourceAssetSearchDto` / `SourceAssetResponseDto` / `PaginationResponseDto` / `source_asset_repository.query`. Cross-checked `use-source-assets.ts` consumers.

Live evidence: GET `?type=image` → 200, 46 normalized assets; picker renders + selects; zero fresh console errors. Code agrees with evidence.

---

## VERIFIED CLEAN (6 areas)

### 1. Pagination mapping ✓
- BFF sends `{limit, offset}` → backend POST `/api/source_assets/search`. `SourceAssetSearchDto` extends `BaseSearchDto` (limit 1..100, offset ≥0) — BFF clamps `page≥1`, `pageSize 1..100`, computes `offset=(page-1)*pageSize`. Valid.
- Repo (L133-135) derives `page = offset//limit + 1`, `total_pages`. Returns `{data, count, page, pageSize, totalPages}` (BaseDto camelCase alias). BFF `{...result, data: normalized}` passes metadata through untouched.
- `SourceAssetPage` type (`types.ts`) shape matches exactly. Consumers (picker L32, hook L9) read only `.data` / `.items` — pagination fields currently unused. No "load more" UI exists.

### 2. Media type mapping ✓
- BFF builds `mime_type = "image/*" | "video/*" | "audio/*"` for valid `type` values; repo (L65-73) handles the three wildcards via SQL `LIKE`. Type fallback omits filter cleanly.
- `normalizeAsset`: `video/*`→video, `audio/*`→audio, else image. Matches stored `MimeTypeEnum` set (only image/jpeg, image/png, video/mp4, audio/*). Safe.

### 3. Response normalization ✓
- Spreads backend fields (camelCased via BaseDto), overrides: `id: String(id)`, `name: originalFilename ?? "Untitled asset"`, `type`, `url: presignedUrl ?? presignedOriginalUrl`, `thumbnailUrl: presignedThumbnailUrl || presignedUrl`.
- All three presigned fields are non-null on `SourceAssetResponseDto`. Fallbacks are defensive. `id` int→string coercion matches frontend `SourceAsset.id: string`.

### 4. Upload normalization ✓
- POST validates `file` (File instance) + `workspaceId` present, CSRF-gated (`verifyCsrf`). Forwards `formData` to `/api/source_assets/upload`. Backend `Form()` names: `workspaceId`, `scope`, `assetType`, `aspectRatio`, `upscaleFactor` — hook sends `workspaceId` (matches), arbitrary `fields` spread for admin opts.
- Response: single `normalizeAsset(asset)`, 201. Hook types return as `SourceAsset`. ✓

### 5. Signed URL rendering/security ✓
- Picker uses raw `<img src={previewUrl}>` with explicit `eslint-disable @next/next/no-img-element` + comment. Correct: `next/image` would re-fetch/optimize GCS signed URLs and break the `X-Goog-Signature` query param. Backend owns signing (`presignedUrl` via `IamSignerCredentials`); BFF never signs/rewrites.
- No `crossOrigin`/`referrerPolicy` set — minor, not a blocker (URLs are short-lived GET-signed, not CORS-config-dependent for `<img>`).

### 6. use-source-assets consumers ✓
- `SourceAssetList` reads `name`, `type`, `createdAt`, `size`; `remove(id)` → `DELETE /api/source-assets/{id}`. `[id]/route.ts` exists, CSRF-gated, proxies to backend. Hook `upload`/`refresh` round-trip match BFF contract.
- Image-studio (L512) + Upscale-studio (L313) `onselect` handlers consume `thumbnailUrl ?? url` + `name` + `id` — all populated by normalize. Video-studio uses same picker via `components/media` re-export. ✓

---

## NON-BLOCKERS (noted, not required fixes)

1. **`size` always blank** — `SourceAssetList` Size column reads `asset.size`; `SourceAssetModel`/`SourceAsset` table has NO size column → always `undefined` → column renders "—". UI degrades; no crash. (Backend gap, not BFF.)
2. **Picker not workspace-scoped** — `GET /api/source-assets?type=image` omits `workspace_id`. For regular users backend forces `target_user_id = current_user.id` and ignores workspace → returns assets across ALL user workspaces. May be intended (user library), but studio pages are workspace-scoped. Confirm intent before scaling.
3. **Silent truncation >50** — pageSize defaults 50; consumers ignore `totalPages`/`count`. A user with >50 assets of one type sees only first page, no "load more". Latent for large libraries.
4. **Client-side search superset** — picker filters `name.includes(search)` locally over one page; never sends `search` query param to BFF (route supports it). Harmless while page ≤50.
5. **Backend upload authz (out of scope)** — backend `/upload` accepts `scope`/`assetType` Form fields with NO role gate (unlike `/search` which clears admin-only filters for non-admins). A non-admin could POST `scope=system`. Current hook call sites never send these fields, so not exploitable from the reviewed Next UI — flag to backend team as defense-in-depth.

---

## BLOCKERS
**None concrete.** All six review dimensions pass against DTOs/controller/repo. Live 200/46-asset/zero-error evidence is consistent with the code. Non-blockers above are data-completeness / scaling / backend-authz notes, not defects in `route.ts` or `asset-picker.tsx`.
