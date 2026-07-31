# Wave 3 — Image Studio recomposition (parity vs Angular `home.component`)

Owner: Image Studio agent. Scope: `frontend-next/src/features/image-studio/**` only.
Angular truth: `frontend/src/app/home/home.component.{html,ts}` + `flow-prompt-box.component.html`.
Primitives adopted from `@/src/components/studio/` (FROZEN, not edited).

## Files changed
- `features/image-studio/types.ts` — ADDITIVE extension. Added to `ImageGenerationRequest`: `googleSearch`, `useBrandGuidelines`, `enhancePrompt`, `mode: ImageMode`, `referenceImages?: ReferenceImage[]`. Added `defaultImageState` entries for the new scalars (booleans false, mode `"Text to Image"`). Added pure helpers `RATIO_LABELS` (14 Angular ratios), `formatRatioLabel(ratio)`, `isGoogleSearchEligible(model)`, plus types `ImageMode`, `ReferenceImage`. `useImageState` hook untouched — picks up new defaults via spread; old persisted state backfills from defaults (no break).
- `features/image-studio/components/image-studio.tsx` — full recomposition. Removed `WelcomeCard`, header ("Studio Workspace"/"Image Studio"), and all imports of old components. Now composes: `StudioHero` (no-result), `GenerationOverlay` (fixed inset, processing/failed), `MediaLightbox variant="image"` (result), `OptionToolbar` (9 items, Angular order), `FlowPromptBox` (modes + settings + reference slots), `ReferenceMediaStrip` + `AssetPicker` (Ingredients mode), `JobPoller` (preserved). `submit`/`getStatus` carried over VERBATIM. `/api/images?options=1` fetch + `useWorkspace` sync + `/api/gemini/rewrite` call moved IN from `generation-form.tsx`/`prompt-input.tsx` (behaviour unchanged; added an unmount `cancelled` guard to the fetch effect).
- `features/image-studio/__tests__/image-options.test.ts` — NEW. `bun:test` + `node:assert/strict` (NOT `node:test`). Covers `formatRatioLabel`, `RATIO_LABELS` length (14), `isGoogleSearchEligible` (3 allowlisted + negatives).

## Gaps closed (vs `parity_routes/generation` IMAGE section)
- ✅ Removed header/eyebrow (Angular has none).
- ✅ `StudioHero` replaces local `WelcomeCard`.
- ✅ `GenerationOverlay` fixed inset with spinner + "Generating Images..." + "You can safely navigate away." (was inline).
- ✅ `OptionToolbar` order: Style, Color & Tone, Lighting, Composition, Negative Phrases (chip grid via `customMenu`), Watermark (Yes/No MENU, not toggle — matches Angular), Google Search (toggle, model-gated via `isGoogleSearchEligible`), Brand Guidelines (toggle), Enhance Prompt (toggle). Last three were missing — added.
- ✅ Negative phrases now a chip grid (was plain text input). Stored canonically as comma-joined `negativePrompt` (wire format preserved); `NegativePhrasesMenu` splits/joins.
- ✅ `FlowPromptBox` replaces `prompt-input.tsx`: Mode selector (Text to Image + Ingredients to Image), Ctrl/Cmd+Enter (primitive-built), settings popover, resolution chip (moved OUT of toolbar INTO flow-prompt-box per Angular).
- ✅ `ReferenceMediaStrip` via `referenceSlots` for Ingredients mode (was absent). Wired to `AssetPicker`.
- ✅ `MediaLightbox variant="image"` replaces `result-panel.tsx` side-by-side card + emoji buttons. Wired: edit, generateVideo(start/end submenu), sendToVto, share, download, seeMoreInfo, delete. `onSendToVideo`/`onSendToVto` BUG FIXED (were declared, never wired).
- ✅ aspectRatioOptions mapped to Angular labels via `formatRatioLabel` (backend gives raw ratios).

## Gaps deferred / known simplifications
- **Cross-feature handoff**: Angular uses router `state: {remixState}`. Next App Router has no router-state equivalent, so `handleGenerateVideo`/`handleSendToVto` write the SAME `remixState` shape to `sessionStorage` key `"remixState"` then `router.push("/video"|"/vto")`. **Read side NOT implemented** — `/video` and `/vto` features must read `sessionStorage.getItem("remixState")` on mount (those agents own it). This is the Next-idiomatic equivalent; flagged for the video/vto agents.
- **MediaLightbox activeIndex not exposed to actions** (PRIMITIVE GAP): the primitive keeps `selectedIndex` internal and action callbacks receive no index. Cross-feature handoff (generateVideo/sendToVto/download/share) uses output index 0 (matches prior `ResultPanel` which only used `presignedUrls?.[0]`). Upgrade path: primitive should pass `activeIndex` into action callbacks. Noted with `ponytail:` comment.
- **`edit` action is a preserved no-op stub** (`update({ prompt: state.prompt })`) — Angular's `editResultImage` opens a cropper/ingredients-edit flow not present in Next. Did not invent; preserved prior behaviour.
- **`assignTags` NOT wired** — no shared tagger component exists in Next; building one is out of minimum-scope. `share` IS wired via Web Share API (`navigator.share`) with clipboard fallback (native, no dep).
- **Reference-slot count fixed at 4** (`MAX_REFERENCE_IMAGES`) — Angular derives from model capabilities; Next has no image capability registry. `ponytail:` comment. Reference list is dense (clearing compacts) — minor UX delta vs Angular's positional slots.
- **Download** opens the signed URL in a new tab (anchor click); signed URLs may not honour a `download` attribute cross-origin.

## Old studio components now ORPHANED (lead to delete — outside my write set, left on disk untouched)
These are no longer imported by `features/image-studio/**`:
- `src/components/studio/generation-form.tsx`
- `src/components/studio/option-controls.tsx`
- `src/components/studio/prompt-input.tsx`
- `src/components/studio/result-panel.tsx`
(Only `image-studio.tsx` imported them; verify no other feature imports before deleting.)

## Primitive prop-surface notes
- `FlowPromptBox` `referenceSlots: ReactNode` — used as the escape hatch for `ReferenceMediaStrip`. Works.
- `OptionToolbar` `customMenu: ReactNode` + `panelClassName="min-w-[20rem]"` — used for the negative-phrases chip grid. Works; chip input needs `event.stopPropagation()` on its container so typing doesn't close the host Menu (handled).
- `MediaLightbox` action signature gap (no activeIndex) — see deferred section.

## Verification
- `diagnostics` clean on `types.ts` and the test file. `image-studio.tsx` diagnostics returned only STALE Tailwind alias suggestions (referenced the removed `WelcomeCard` at a line beyond the new file length) + style hints matching the codebase's existing `var(--tri-*)` convention (all primitives/old components use the same form). No TS/JSX errors.
- Eye-checked: `"use client"` is a literal directive (not `import`); alias is `@/src/...` (never `@/lib/...`); no `next/image` in feature code; barrel `index.ts` unchanged and still exports `ImageStudio` (page imports unchanged); no imports of the 4 old components remain.
- NOT run (no terminal): `bun test`, `next build`, pre-commit. Test uses `bun:test` per repo rule (video-studio convention; media-lightbox test still uses `node:test` which is the dead-test bug — not my file).
