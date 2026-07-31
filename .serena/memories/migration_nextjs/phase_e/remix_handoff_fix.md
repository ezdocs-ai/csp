# Phase E — Remix Handoff Receivers (/video + /vto)

Consumer side of the cross-feature remix handoff. Writers (gallery
`gallery-actions.ts` builders + image-studio `handleGenerateVideo`/
`handleSendToVto`, see `mem:migration_nextjs/phase_e/gallery_actions_fix` and
`mem:migration_nextjs/parity_impl/wave3_image`) stage the SAME `remixState` shape
under `sessionStorage["remixState"]` then navigate. This memory documents the
`/video` and `/vto` mount-only readers.

## Pattern (established here)
- **SSR-safe deferred effect**: `useEffect(() => { const frame =
  requestAnimationFrame(cb); return () => cancelAnimationFrame(frame); }, [])`.
  Mirrors `useVideoState`/`useImageState` rAF-restore (defers browser-only state
  past hydration, mount-only via empty deps). `useEffect` never runs on server.
- **Consume once**: read key → `JSON.parse` (try/catch) → `removeItem` (try/catch)
  → parse → apply. Key removed regardless of parse outcome (one-shot; gallery
  re-stages fresh each navigation).
- **Validate shape, keep only recognized fields**: pure parser returns null for
  non-handoff shapes; unknown keys ignored; invalid array entries filtered.
- **Don't overwrite explicit template props**: video patch is guarded by
  `key in initialState` — remix only hydrates gaps. VTO has no initialState, so
  it always applies.

## Files owned
- `frontend-next/src/features/video-studio/remix-handoff.ts` —
  `parseVideoRemix(raw)` + `videoRemixPatch(intent, initialState)`. Exports
  `REMIX_STATE_KEY`, `VideoRemixIntent`, `VideoRemixPatch`, `SlotAsset`. Pure.
- `frontend-next/src/features/video-studio/__tests__/remix-handoff.test.ts`
- `frontend-next/src/features/vto-studio/remix-handoff.ts` —
  `parseVtoRemix(raw)`. Exports `REMIX_STATE_KEY`, `VtoRemixIntent`. Pure.
- `frontend-next/src/features/vto-studio/__tests__/remix-handoff.test.ts`
- `frontend-next/src/features/video-studio/components/video-studio.tsx` —
  added import + one deferred `useEffect([])` after the model-defaults effect.
- `frontend-next/src/features/vto-studio/components/vto-studio.tsx` —
  added import + one deferred `useEffect([])` after `showErrorOverlay` state.

## Role → slot/state mapping (video)
Mirrors `mode-slots.ts` + in-studio toolbar handlers:
- `start_frame`            → frames-to-video, slot `start`  (preview = startImagePreviewUrl)
- `end_frame`              → frames-to-video, slot `end`    (preview = endImagePreviewUrl)
- `video_extension_source` → extend-video, slot `source`    (+ generationModel veo-3.1)
- `concatenation_source`   → concatenate-video, slot `first`
- Omni `referenceVideo`    → ingredients-to-video, slot `ref-video` (+ generationModel gemini-omni, parentMediaItemId)
- Omni `referenceAudio`    → ingredients-to-video, slot `ref-audio`
- `prompt`/`generationModel` → state patch only if absent from initialState.

## VTO mapping
`modelImageAssetId` → `setPersonAsset(String(id))`;
`modelImagePreviewUrl` → `setPersonPreviewUrl`; `setPersonIsUpload(false)`
(treated like a preset selection, not an upload). Gallery media id used directly
as personAssetId (matches image-studio writer contract).

## Decisions / ponytails
- `REMIX_STATE_KEY` hardcoded in each feature's `remix-handoff.ts` (not imported
  from gallery) — keeps features decoupled; matches image-studio precedent which
  also hardcodes `"remixState"`. Drift risk minimal (documented contract).
- Prompt-only payload (no media) rejected by `parseVideoRemix` — every real
  video handoff pairs a prompt with a media source / Omni ref.
- Omni intent binds `referenceVideo`→`ref-video` (correct omni video-ref slot),
  NOT `ref-0` (image slot) which the in-studio `handleEditWithOmni` ponytails.
- Gallery extend/concatenate builders deliberately omit `parentMediaItemId`; we
  respect that (only Omni sets it). Slot binding carries the source.
- Remix effect's rAF is scheduled AFTER `useVideoState`'s restore rAF (hook
  declared before component effects) → React 18 auto-batching composes the
  functional `update` merge on top of restored state correctly.

## Validation
- `bun test frontend-next/src/features/{video-studio,vto-studio}` → 22 pass
  (14 new remix-handoff + 8 pre-existing mode-slots/step-validity), 0 fail.
- Diagnostics clean on all 6 files (remaining Tailwind `text-[var(...)]` hints
  are pre-existing in vto-studio, not touched).
- No image files read. No cross-feature edits outside the two owned components +
  their feature-local helpers/tests.

## Open / next
- App-route pages (`app/(studio)/video/page.tsx`, `/vto/page.tsx`) render these
  studios; templates agent owns `initialState` wiring — confirmed VideoStudio
  accepts `initialState?: Partial<VideoGenerationRequest>`, VtoStudio takes none.
- End-to-end handoff (gallery → studio) untested at runtime; only pure parsers
  + patch covered. Integration awaits the route pages.
