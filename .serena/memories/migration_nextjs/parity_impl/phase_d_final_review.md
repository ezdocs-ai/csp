# Phase D — FINAL read-only review (recovery slice)

Date: 2026-07-29. Reviewer: final gate. READ-ONLY (no edits).
Scope re-audited against CURRENT files (not memory alone):
  image/video localStorage hydration hooks; image model allowlist/reconciliation
  + JobPoller callback; app/api/images route strip; app/api/source-assets route
  + asset-picker; Upscale route/types/test; VTO route/assets route/component
  URL+preview; nested-main sweep.

## BLOCKERS
**NONE.** No build/type errors, no React loops/hydration defects, no Next
server/client boundary violations, no request-contract mismatches, no unsafe
signed-URL rendering, no regressions found in the reviewed slice.

Empirical proof gathered this pass:
- `diagnostics` project-wide = **0 errors** (refreshed). Every in-scope file
  reports 0 errors; remaining counts are pre-existing gts/ESLint *style*
  warnings (asset-picker 14, job-poller 1, image-studio 11, upscale-studio 62,
  vto-studio 32, video-studio 1). None are type errors.
- No `app/api/**` route file carries `"use client"` → server boundary clean.
- Only 4 `<main>` survive the sweep, all legitimate non-nested: admin layout
  (`(admin)/admin/layout.tsx` L61 `id="main-content"`), studio layout
  (`(studio)/layout.tsx` L72 `id="main-content"`), login (`(public)/login`), and
  the standalone `app/visual/page.tsx`. Every feature/page wrapper now uses
  `<section>` (image L452 `aria-label="Image studio"`, upscale L106
  `aria-label="Upscale studio"`, vto L308 `aria-label="Virtual try-on studio"`).

## Supplied LIVE evidence (carried forward — consistent with code)
- All five studio POSTs return **202** (image /api/images, video /api/video,
  audio /api/audio, upscale /api/upscale → /api/images/upload-upscale, vto
  /api/vto → /api/images/generate-images-for-vto).
- All status polls return **200** (/api/{images,video,audio,upscale,vto}/[id]
  → /api/gallery/item/{id}).
- Video + Audio jobs reached **completed** and surfaced the result via
  `presignedUrls[0]` (the `data.signedUrl` bug H1 is fixed in code — both read
  `presignedUrls`).
- Fresh browser console = **zero** errors/warnings on the final flows.

## VERIFIED per slice

### 1. Hydration hooks (`use-image-state.ts`, `use-video-state.ts`)
- `useState` initializer builds state from `default`/`fallback` + `initial`
  only → deterministic SSR HTML == client first render. `localStorage` touched
  solely inside `useEffect` (post-mount). No `localStorage is not defined` on
  SSR, no hydration mismatch.
- Restore runs in `requestAnimationFrame` after `getItem`+`JSON.parse`; merge
  order `{...default, ...saved, ...initial}` → `initial` (server-derived
  workspaceId/props) wins. `restored` ref gates persistence writes so the
  capture can't be clobbered on mount.
- Cleanup `cancelAnimationFrame(frame)` with `frame` defaulting `undefined`
  (no-op if parse threw pre-schedule). StrictMode double-mount safe.
- Non-blocker: `use-video-state.ts` L59 `useMemo(() => state, [state])` is a
  no-op (returns same identity). Dead, harmless, delete-candidate.

### 2. Image allowlist/reconciliation + JobPoller callback
- C1 loop FIXED & verified in code: `image-studio.tsx` `getStatus` deps =
  `[jobId]` (L131), NOT `[job]`. `setJob` inside the callback mutates a
  different variable, so `getStatus` identity is stable for a job's lifetime.
  Compare siblings (VTO `[jobId]`, Upscale `[mediaItemId]`) — same safe shape.
- Polling wired via `<JobPoller enabled={job.status==="processing"}
  getStatus={getStatus} onStatus={handleJobStatus} />` (L548). `JobPoller`
  (`components/studio/job-poller.tsx`) calls `useMediaJob(getStatus,5000,enabled)`
  and forwards status through `useEffect([onStatus,status])`. No re-subscribe
  storm.
- Model reconciliation effect (L270-277): when `state.generationModel` not in
  `modelOptions`, sets it to `activeModel` (= `modelOptions[0]`); after the
  update the membership check is false → effect is self-terminating, no loop.
  `modelOptions` is `useMemo([options])`; `IMAGE_MODEL_OPTIONS` order locked by
  `image-options.test.ts`.
- M3 stale-status flash FIXED & in code: `use-media-job.ts` L16-21 resets
  `status` to `"processing"` on the first tick of every new subscription via a
  `first` flag (no synchronous setState in effect body → React-Compiler-safe).

### 3. app/api/images route strip
- POST strips `mode` + `referenceImages` (denylist) before forwarding to
  `/api/images/generate-images`; `CreateImagenDto` is `extra="forbid"` so the
  strip is necessary, not cosmetic. Response `{mediaItemId: item.id ??
  item.mediaItemId, ...item}` → 202.
- Non-blocker (re-flag): strip is a **denylist**, fragile if a future UI-only
  field is added to `ImageGenerationRequest` without updating the list → backend
  422. Allowlist (pick known DTO keys) is safer; current field set is correct.
- Non-blocker: `submit` also reads `body.gcsUris` from both the POST response
  and the poll. `MediaItemResponse` exposes `presignedUrls` (used for display);
  `gcsUris` may be absent → the VTO handoff `modelImageGcsUri` can be
  `undefined`. Harmless because the VTO request uses `source_asset_id`, not the
  gcsUri.

### 4. app/api/source-assets route + asset-picker
- GET → `/api/source_assets/search` with `{limit, offset, mime_type?, original_filename?}`;
  page≥1 / pageSize 1..100 clamped; `normalizeAsset` coerces id→string, maps
  type from mimeType, falls back url/thumbnailUrl defensively. POST CSRF-gated,
  validates `file`+`workspaceId`, forwards FormData → `/api/source_assets/upload`, 201.
- `asset-picker.tsx`: `"use client"`, reads `data.data ?? data.items`, renders
  `<img src={previewUrl}>` with explicit `eslint-disable
  @next/next/no-img-element`. Correct — signed URLs MUST bypass next/image
  optimization (would re-fetch and break the `X-Goog-Signature`). Not unsafe:
  backend-owned short-lived GET-signed URLs rendered into `src` (no `dangerouslySetInnerHTML`).
- Re-flagged non-blockers (pre-existing, data-completeness not defects): `size`
  column always blank (no size column on model); picker not workspace-scoped;
  pageSize 50 with no load-more (latent >50 assets); client-side search over one
  page; backend `/upload` lacks a role gate on `scope`/`assetType` Form fields
  (defense-in-depth; current call sites never send them, not exploitable from
  this UI).

### 5. Upscale route/types/test
- Route POST → `/api/images/upload-upscale` (multipart Form) via
  `buildUpscaleFormData`; validates `workspaceId` int≥1, `factor` ∈ {2,4},
  `sourceAssetId`||`mediaItemId` string. `result.id`→`{mediaItemId: String(id)}` 202.
- `buildUpscaleFormData` (types.ts): factor 2|4 → `x2`|`x4`; `sourceAssetId`
  under backend `id` alias; `mediaItemId` under `mediaItemId`; snake_case
  `enhance_input_image`/`image_preservation_factor`; null preservation treated
  as unset. Contract locked by `upscale-contract.test.ts` (6 cases, bun:test).
- Client `use-upscale.ts` uses `csrfFetch` (C2 fix holds). `upscale-studio.tsx`
  `getStatus` deps `[mediaItemId]`, `useMediaJob(getStatus,5000,Boolean(mediaItemId))`;
  reads `job.presignedUrls`/`originalPresignedUrls` for before/after.
- Non-blocker: `originalPresignedUrls` is ponytail-marked against Angular's
  MediaItem shape; if backend omits it, `beforeUrl` is undefined and the
  comparison view degrades to after-only (no crash).

### 6. VTO route/assets route/component
- Route POST → `/api/images/generate-images-for-vto` with `{workspace_id,
  person_image:{source_asset_id}, ...top/bottom/dress/shoe_image:{source_asset_id}}`.
  `GARMENT_IMAGE_FIELD` maps plural slot `shoes`→singular `shoe_image`
  (VtoDto `extra="forbid"`; the prior `shoes_image`→422 bug is fixed). Validates
  workspaceId int≥1, personAssetId non-empty, garment slot ∈ allowlist, assetId
  integer. Response `{mediaItemId: item.id ?? item.mediaItemId, ...item}` 202.
- `[id]` GET → `/api/gallery/item/{id}` (idempotent, no CSRF — correct). Component
  `getStatus` deps `[jobId]`, polls every 15s, `setMedia(body)`.
- assets route GET → `/api/source_assets/vto-assets` passthrough (snake_case
  top-level keys, camelCase nested). Component presets effect has `ignore` guard,
  maps `female_models/male_models/tops/bottoms/dresses/shoes` → PresetLibrary,
  catch→EMPTY_PRESETS, finally clears loading. No loop.
- M4 FIXED & in code: `lightboxMedia.mimeType = media.mimeType ?
  String(media.mimeType) : undefined` (reads top-level field, no hardcoded
  `image/png`).
- Non-blocker: `number_of_media` omitted → backend default 1 (single-image VTO
  gap, not a runtime break).

### 7. nested-main sweep
- 19 files converted `<main>`→`<section>` (see `phase_d_nested_main_fix`).
  Re-verified: only the 4 legitimate layout/standalone mains remain. No
  duplicate landmark, no a11y H1 regression.

## Recommendation
Slice is ship-ready. No blocking action required. Optional hardening only:
convert the image route strip to an allowlist; delete the no-op
`useMemo` in `use-video-state.ts`; (backend) add a role gate on
`/source_assets/upload` scope/assetType and a `size` column if the picker's Size
column is expected to populate.
