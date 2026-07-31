# Wave 3 — VTO (Virtual Try-On) studio port

Owner: VTO agent. Source of truth = Angular `frontend/src/app/vto/`. Write set: `frontend-next/src/features/vto-studio/**` only.

## Files changed
- `frontend-next/src/features/vto-studio/components/vto-studio.tsx` — FULL REWRITE (flat 2-col form → Angular stepper composition). ~490 lines.
- `frontend-next/src/features/vto-studio/__tests__/step-validity.test.ts` — NEW. One `bun:test` for `isStepOneValid` (step-validity logic).
- UNTOUCHED (preserved verbatim): `hooks/use-vto-state.ts`, `types.ts`, `index.ts`, `app/(studio)/vto/page.tsx` (requireUser guard already present — left alone).

## types.ts status
Already had additive fields from a prior pass — USED as-is, no edits: `Gender`, `PresetAsset`, `VtoPresetCategory`, `isStepOneValid(gender, personAssetId)`. `GarmentSlot`, `VtoRequest`, `VtoResponse` unchanged. The page imports only `VtoStudio`; `index.ts` already exports it → no barrel change needed.

## Gaps CLOSED (vs parity_routes/generation VTO section)
1. Stepper — built LOCALLY as conditional render + `activeStep` state (no library, ~25 lines inline). `aria-current="step"` on active step indicator; linear (Next button disabled until step 1 valid).
2. Gender radio — native `<input type="radio" name="vto-gender">` pair (Female/Male), default "female" (Angular default). Gender flip clears a PRESET model selection but keeps an uploaded one (Angular parity).
3. Preset model card grid — driven from `/api/source_assets/vto-assets` (`female_models`/`male_models`). Real endpoint (confirmed in openapi.json). `selected` highlight via `state.personAssetId === m.id`.
4. Upload dropzone (person) — native `<input type="file">` + drag-drop, POST `/api/source_assets/upload` (multipart `file`+`workspaceId`+`assetType`, csrf header). Preview + clear. Keyboard: `role="button"` tabIndex 0, Enter/Space.
5. Four labeled garment sections (Tops/Bottoms/Dresses/Shoes) — each = compact upload dropzone + horizontal preset card grid (`tops`/`bottoms`/`dresses`/`shoes` from same endpoint), `selected` state. (Was 4 unlabeled text-buttons.)
6. "Selected Model" preview pane + "Back to Model Selection" + gradient "Try on!" (disabled unless step 1 valid).
7. StudioHero — title "Creative Studio Virtual Try-On" + subtitle.
8. GenerationOverlay — processing + failed fixed overlays; failed has Close (`showErrorOverlay`).
9. MediaLightbox variant "image" replaces bare MediaCard. Wired `delete` (clears local media/jobId — see DEFERRED) and `seeMoreInfo` (`router.push('/gallery/{id}')`).
10. Inline step-2 states: processing spinner / completed lightbox / failed message (Angular parity).

## Preset model data — SOURCE LOCATED
Endpoint `/api/source_assets/vto-assets` EXISTS in `frontend-next/openapi.json` → `VtoAssetsResponseDto` {female_models, male_models, tops, bottoms, dresses, shoes} each `SourceAssetResponseDto[]` (id, originalFilename, presignedUrl, presignedThumbnailUrl). Wired via fetch on mount. Grids are EMPTY until backend system assets are seeded (Angular's arrays are also `[]` in code); upload path works independently. NOT invented.

## Gaps DEFERRED
- **Examples row**: Angular refs `assets/images/vto/upload-photo-1..4.png` which are ABSENT on disk in BOTH `frontend/` and `frontend-next/public/`. Driven from `UPLOAD_EXAMPLES = []` with `ponytail:` comment. To populate: copy real assets into `frontend-next/public/images/vto/` (outside this agent's write set).
- **MediaLightbox delete**: only clears local state (no `/api/gallery/bulk-delete` call) — Angular calls backend delete. Conservatively not wired because delete contract (item_type/workspace) is outside preserved VTO logic and would be new behavior. Upgrade: call `/api/gallery/bulk-delete` with `{items:[{id,type:'media_item'}], workspace_id}` when a real delete is required.
- **Garment conflict enforcement** (Angular's dress↔top/bottom mutual-exclusion snackbars): NOT ported — backend rejects invalid combos; snackbar infra doesn't exist in Next. Add when a notification system lands.
- **Remix / send-to-video / generate-video** result actions: Angular wires editClicked/generateVideoClicked/sendToVtoClicked via router state. Not wired (task scoped delete + seeMoreInfo only). Wire via `MediaLightbox actions.{edit,generateVideo,sendToVto}` when cross-feature router-state handoff is specced.

## Primitive prop-surface gaps
None. `StudioHero`, `GenerationOverlay`, `MediaLightbox` (variant "image") used as-is from `@/src/components/studio/*` (direct file imports, no barrel). StepperFlow built locally per generation_primitives memo ("VTO agent owns") — NOT added to `components/studio/`.

## Verification
- `diagnostics` on `vto-studio.tsx`: 0 errors. Only Tailwind shorthand ADVISORY warnings (`text-[var(--tri-text-secondary)]`→`text-foreground-secondary`, etc.) — these are identical to the style used by the FROZEN `components/studio/*` primitives, so matched for consistency; not pre-commit blockers.
- Fixed 1 error: removed redundant sync `setLoadingPresets(true)` in effect (initial state already true; triggered React-19 "setState in effect" rule).
- Eye-checked: `"use client"` literal directive (not import); all aliases `@/src/...` (no `@/lib/`); each remote `<img>` has `eslint-disable-next-line @next/next/no-img-element` on its OWN line; submit/getStatus preserved byte-for-byte (POST `/api/vto` csrf + poll `/api/vto/{id}` 15s).
- NOT verified (no terminal): `bun test`, `next build`, runtime fetch of vto-assets. Test file uses `import { expect, test } from "bun:test"` (not node:test).
