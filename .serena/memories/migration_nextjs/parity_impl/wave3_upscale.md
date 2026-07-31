# Wave 3 — Upscale parity impl log

Owner: Upscale agent. Scope: `frontend-next/src/features/upscale/**` ONLY. Source of truth: Angular `frontend/src/app/upscale/`.

## Files changed
- `features/upscale/components/upscale-studio.tsx` — FULL REWRITE (was one brittle single-line generic card). Now Angular-faithful composition using built primitives.
- `features/upscale/types.ts` — UNCHANGED (already had additive `enhance_input_image?` / `image_preservation_factor?`).
- `features/upscale/hooks/use-upscale.ts` — UNCHANGED (PRESERVED VERBATIM: `useUpscale` POST `/api/upscale`).
- `features/upscale/index.ts` — UNCHANGED (exports `UpscaleStudio`, `UpscaleRequest`, `UpscaleResponse`; `app/(studio)/imagen-upscale/page.tsx` imports `UpscaleStudio` ✓).

## Gaps closed (Angular parity)
- [layout] `StudioHero` — gradient + "Creative Studio Imagen Upscale" + subtitle "An AI tool for generating high-quality image ✨".
- [state] `GenerationOverlay` — processing/failed fixed overlay; onDismiss clears local `errorDismissed` flag; failed message from `job.errorMessage`.
- [CRITICAL] Before/after comparison via `MediaLightbox variant="comparison"` with `beforeUrl`/`afterUrl`. Slider NOT reimplemented — primitive owns it (native `<input type="range">` + clipPath).
- [layout] Step-progress header: `1 Upload Image to Upscale` → progress line → `2 Upscaled Result`; line fills + step-2 badge activates when processing/done.
- [missing] Drop zone: drag-drop + click-to-open (opens `AssetPicker`); placeholder (real `<button>`, keyboard-op) OR preview `<img>` + hover/focus Change/Delete overlay (real buttons, stopPropagation via separate elements — no nested buttons) OR processing spinner.
- [missing] Settings box: Upscale Factor buttons (2x/4x, `aria-pressed`, matches `factor: 2|4` type); "Enhance Input Image" native checkbox in `<label>`; "Image Preservation Factor" NATIVE `<input type="range">` (0–1 step 0.1, shows "Auto" when null via `aria-valuetext` + label, helper text); gradient Upscale button (from-blue-500/via-violet-500/to-red-400), disabled unless `canSubmit && !isProcessing`.
- [actions] Download (preserved `/api/gallery/download?ids=` via programmatic anchor) + See more info (`router.push('/gallery/${id}')` — gallery has `[id]` dynamic route).

## PRESERVED feature logic (verbatim intent)
- `useUpscale` POST `/api/upscale`.
- `useMediaJob(getStatus, 5000, Boolean(mediaItemId))` polling `/api/upscale/{id}`. getStatus extended ADDITIVELY to `setJob(data)` so comparison can read URLs (useMediaJob only returns status — out of scope to edit, lives in `src/lib/hooks/`).
- download via `/api/gallery/download?ids=`.
- workspace/canSubmit gating.

## Primitive prop-surface GAP (reported)
- **`MediaLightbox` `comparison` variant ignores `actions`.** In `components/studio/media-lightbox.tsx` the component does `if (variant === "comparison") return <ComparisonView .../>` BEFORE rendering `ActionsToolbar`. So `download`/`seeMoreInfo` passed to a comparison variant are silently dropped.
  - Workaround (this feature): rendered Download + See-more-info buttons LOCALLY below `<MediaLightbox variant="comparison">`. Marked with `ponytail:` comment.
  - Fix suggestion for primitive owner: have `ComparisonView` accept + render the actions toolbar (or move the early-return to compose actions).

## Deferred / unverified
- `/api/upscale` (POST), `/api/upscale/{id}` (GET), `/api/gallery/download?ids=` are NOT in `frontend-next/openapi.json`. The only upscale-related endpoints in openapi are `POST /api/images/upload-upscale` (multipart, returns MediaItemResponse) and `POST /api/images/upscale-image` (JSON UpscaleImagenDto → ImageGenerationResult, synchronous). Preserved the existing fetch contract per task instructions (PRESERVE VERBATIM) + `ponytail:` comment on the `UpscaleJob` type noting the shape mirrors Angular MediaItem. **Backend wiring unverified — likely needs reconciliation with `/api/images/upscale-image` (synchronous) or `/api/images/upload-upscale`.**
- Result URL shape (`originalPresignedUrls[0]` = before, `presignedUrls[0]` = after) mirrors Angular; unverified against actual `/api/upscale/{id}` response.
- No tests added: only trivial view wiring + preserved logic. `clipInset` already covered by primitive owner; no NEW non-trivial pure logic introduced.

## Verification done
- `read_file` on full file after each `edit_file`/`write_file` — no truncation, no garbage.
- `diagnostics`: only Tailwind v4 shorthand style nits (`[var(--tri-*)]` → `(--tri-*)`); matches codebase convention (all sibling files use `[var(--tri-*)]`). No TS/ESLint errors. (Stale line-428 warnings are residual from the pre-rewrite single-line version.)
- Eye-check: `"use client";` literal at top (not `import "use client"`); all imports `@/src/...` (no `@/lib/...`); `no-img-element` eslint-disable on own line above each `<img>`; `JobStatus` imported from `use-media-job`; hit targets ≥44px (`min-h-11`); range + checkbox labelled; dropzone keyboard-operable via real `<button>`.
- NO terminal/build run (instructions: no terminal).
