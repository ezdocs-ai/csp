# Phase D — VTO Runtime Path Audit & Fix

Date: 2026-07-29
Scope owned: `csp/frontend-next/app/api/vto/**`, `csp/frontend-next/src/features/vto-studio/**`
Out of scope (lead-owned, NOT edited): `app/api/source-assets/**`, `src/components/media/asset-picker.tsx`
Backend contract: `csp/backend/src/images/dto/vto_dto.py` (VtoDto, VtoInputLink), `imagen_controller.py` POST `/api/images/generate-images-for-vto`, `galleries/gallery_controller.py` GET `/api/gallery/item/{id}` → `MediaItemResponse`.

## Runtime path traced
1. `vto-studio.tsx` `submit()` → POST `/api/vto` with `{ workspaceId:number, personAssetId:string, garments:{slot:GarmentSlot,assetId:string}[] }`, header `x-csrf-token` from `csp_csrf` cookie.
2. `app/api/vto/route.ts` POST → CSRF check → validates workspaceId int≥1, personAssetId non-empty string, garments non-empty array, slot ∈ {top,bottom,dress,shoes}, assetId non-empty string → maps each garment to `${slot}_image: {source_asset_id:number}` → POST backend `/api/images/generate-images-for-vto` with `{workspace_id, person_image:{source_asset_id}, ...garments}` → returns `{mediaItemId: item.id ?? item.mediaItemId, ...item}` 202.
3. `vto-studio.tsx` polls via `useMediaJob` → `app/api/vto/[id]/route.ts` GET → backend `/api/gallery/item/{id}` → `MediaItemResponse`. Reads `body.status` (JobStatus), `body.presignedUrls`, `body.mimeType`, `body.errorMessage`.

## Verification results (all CONFIRMED correct)
- **Asset IDs/types**: route coerces `Number(assetId)`, validates `Number.isInteger`. Backend `VtoInputLink.source_asset_id: int`. ✅
- **Workspace**: route validates `workspaceId` int≥1; sends `workspace_id`. Backend `VtoDto.workspace_id: int (ge=1)`. `BaseDto` has `populate_by_name=True` so snake_case accepted. ✅
- **CSRF**: `CSRF_COOKIE="csp_csrf"`; component reads same cookie, sends `x-csrf-token` header; route `verifyCsrf(cookie,header)`. GET polling intentionally has no CSRF (idempotent read). ✅
- **Request field aliases**: `BaseDto` config = `{alias_generator=to_camel, extra="forbid", populate_by_name=True}`. snake_case keys (`workspace_id`, `person_image`, `top_image`, `bottom_image`, `dress_image`, `source_asset_id`) all valid via populate_by_name. ✅
- **Response mediaItemId**: `MediaItemModel.id: int|None`; route emits `mediaItemId: item.id ?? item.mediaItemId`; component `setJobId(String(body.mediaItemId))`; `[id]` route validates `/^\d+$/`. ✅
- **Polling/result fields**: `JobStatusEnum` = processing/completed/failed/stopped == frontend `JobStatus`. `MediaItemResponse` (via `BaseDocumentMixin` `alias_generator=to_camel`, FastAPI `response_model_by_alias=True` default) emits camelCase `presignedUrls`, `mimeType`, `errorMessage`, `metadata` == `VtoMedia` type fields. ✅
- **`number_of_media`**: route omits; backend default=1 applies. Feature gap (single image), NOT a runtime break. Left as-is.

## BUG FOUND & FIXED (evidenced)
**`shoes` slot → `shoes_image` mismatch.** `route.ts` built key as `${slot}_image` directly. Frontend `GarmentSlot` includes `"shoes"` (plural) but backend `VtoDto` field is `shoe_image` (singular). Because `BaseDto.extra="forbid"`, any request containing a shoes garment caused backend **422 Validation Error** (extra field `shoes_image`) AND `shoe_image` was never populated. Effect: shoes-only requests hard-failed; shoes+other combos silently dropped the shoe (validator `check_at_least_one_garment` still passed on the other garment).

### Fix applied
File: `csp/frontend-next/app/api/vto/route.ts`
- Added module const `GARMENT_IMAGE_FIELD: Record<string,string> = {top:"top", bottom:"bottom", dress:"dress", shoes:"shoe"}` (slot → backend field suffix).
- Garment mapping now uses `${GARMENT_IMAGE_FIELD[garment.slot]}_image` so "shoes" → `shoe_image`.
- Frontend whitelist `["top","bottom","dress","shoes"]` UNCHANGED (those are the `GarmentSlot` union values, correct on the wire from component).

## Files changed
- `csp/frontend-next/app/api/vto/route.ts` (slot→field map + comment; 1-line mapping change)

## Files audited, NOT changed (no defect)
- `csp/frontend-next/app/api/vto/[id]/route.ts`
- `csp/frontend-next/src/features/vto-studio/hooks/use-vto-state.ts`
- `csp/frontend-next/src/features/vto-studio/types.ts`
- `csp/frontend-next/src/features/vto-studio/components/vto-studio.tsx`
- `csp/frontend-next/src/features/vto-studio/index.ts`

## Validation
- `diagnostics` on `app/api/vto/route.ts` → no errors/warnings.
- No tests exist for the route handler (only `step-validity.test.ts` for `isStepOneValid`). Route is a thin Next.js server handler with mocked external fetch; per ladder, trivial wiring — no new test added.

## Open / non-runtime notes (not actioned)
- `UPLOAD_EXAMPLES` empty (Angular assets `upload-photo-1..4.png` absent on disk) — cosmetic, ponytail-marked already.
- Preset grids depend on seeded system VTO assets (`/api/source_assets/vto-assets`); empty until bootstrap seed runs.
