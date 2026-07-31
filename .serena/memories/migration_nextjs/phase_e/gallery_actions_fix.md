# Phase E — Gallery detail action toolbar wiring (Next.js)

Scope owned: `frontend-next/src/features/gallery/gallery-actions.ts` (new),
`frontend-next/src/features/gallery/components/gallery-detail.tsx`,
`frontend-next/src/features/gallery/__tests__/gallery-actions.test.ts` (new),
`frontend-next/src/features/gallery/index.ts` (barrel export).
NOT touched: video/audio/vto studio pages + features (agent-owned), the
`components/studio/media-lightbox.tsx` overlay primitive (agent-owned, known
`activeIndex` gap per `mem:migration_nextjs/parity_impl/wave3_image`), backend,
Angular. Resolves parity P0 `mem:migration_nextjs/phase_e/content_audit` §B5
("Gallery detail action toolbar never wired").

## Handoff contract decision (source of truth)
Angular `MediaDetailComponent` (frontend/.../gallery/media-detail/
media-detail.component.ts L312-478) carried each intent via Angular router
`state: { remixState }`. Next App Router has NO router-state. The ESTABLISHED
migration substitute (already used by `features/image-studio/components/
image-studio.tsx` `handleGenerateVideo`/`handleSendToVto`, and documented in
`mem:migration_nextjs/parity_impl/wave3_image` L24-25) is: stage the SAME
`remixState` shape under `sessionStorage["remixState"]` then `router.push(route)`.
This task implements the WRITE side from gallery detail. The READ side
(`sessionStorage.getItem("remixState")` on mount) is owned by the /video and
/vto feature agents — NOT implemented here (would cross into agent-owned pages;
their studios currently consume NOTHING). Image-remix prompt is ALSO carried in
the `/?prompt=` query because the image studio (`(studio)/page.tsx`) is the one
studio that consumes router URL params → real prompt prefill now; reference-image
handoff (sourceMediaItems) is staged in sessionStorage pending the read side.

## Changes
1. `gallery-actions.ts` — PURE ports of the 6 Angular handlers as
   `buildImageRemix / buildVideoStart / buildVideoEnd / buildSendToVto /
   buildEditWithOmni / buildExtendWithAi`, each returning
   `{ route, remixState }` (no router/DOM). Plus `mediaKind` + `isImageMedia /
   isVideoMedia / isAudioMedia` predicates (mirror Angular getters) and a thin
   `stageRemix(intent)` side-effect wrapper returning the route (mirrors
   image-studio idiom; try/catch no-op when storage blocked). Shapes are
   byte-faithful to Angular (roles: input / start_frame / end_frame /
   video_extension_source / concatenation_source; omni: generationModel
   'gemini-omni', isOmniMode true, referenceAudio|referenceVideo branch;
   extend: generationModel 'veo-3.1-generate-001'; concatenate:
   startConcatenation true). `itemType` hardcoded 'media_item' (detail media is
   always a media_item; `MediaItemResponse` carries no itemType field).
   `REMIX_STATE_KEY = "remixState"` exported for shared use.
2. `gallery-detail.tsx` — added conditional action buttons in the EXISTING
   actions row (gated on `itemId`, same row as preserved Download/Assign
   tags/Delete):
   - isImage: Edit / remix (→ /?prompt=), Use as start frame, Use as end frame,
     Virtual Try-On (→ /video, /video, /vto).
   - isVideo: Edit with Omni, Extend, Concatenate (→ /video).
   - Audio: no new buttons (Angular toolbar offers none for audio: all of
     edit/video/vto gated isImage, omni/extend/concat gated isVideo; the omni
     `isAudio` branch is dead from this toolbar but ported verbatim for fidelity).
   Plain `<Button>`s (no `<Menu>`) — minimal, avoids Menu nested-button trigger
   styling. `runRemix = (intent) => router.push(stageRemix(intent))`. Two
   explicit start/end buttons instead of Angular's mat-menu (clearer, fewer
   moving parts; same intents).
3. `index.ts` barrel: `export * from "./gallery-actions"`.
4. `__tests__/gallery-actions.test.ts` — 11 PURE intent tests (bun:test): mediaKind
   classification + predicates, each builder's route + remixState shape
   (roles/preview-urls/flags), omni video vs audio branch, prompt query
   present/omitted. NO sessionStorage/DOM tests (stageRemix is a 1-line side
   effect; repo has no jsdom route-handler test infra).

## Preserved (untouched)
Download (`downloadZip`), Assign tags (`TagAssigner`), Delete (`ConfirmDialog` +
`deleteMedia`). Share / copy-link / see-more stay in the `media-lightbox` overlay
primitive ("already current"); NOT added to the detail page. No backend
mutations added or changed (all actions are client nav + sessionStorage).

## Validation
- `bun test src/features/gallery`: 30 pass / 0 fail (11 new + 19 existing).
- `npx eslint <3 files>`: clean (exit 0).
- diagnostics: gallery-actions.ts + test = 0 errors/warnings; gallery-detail.tsx
  = only pre-existing codebase-wide Tailwind `[var(--...)]` "can be written as"
  style nits on UNTOUCHED lines (no new issues from added buttons, which use the
  shared `<Button>` primitive).
- Repo pre-commit gts hooks target `frontend/` (Angular) only; they do NOT cover
  `frontend-next/`. Only `addlicense` applies → all new/edited files carry the
  Apache-2.0 Google header.

## Dependencies / follow-ups
- READ side pending: `/video` + `/vto` feature agents must read
  `sessionStorage.getItem("remixState")` on mount for the staged payloads to
  prefill. Until then, gallery→video/vto/omni/extend/concatenate buttons
  NAVIGATE correctly but do not prefill (honest partial fidelity; matches the
  documented wave3 gap).
- Image-remix reference-image handoff can't map media-item IDs to source-asset
  IDs (image studio consumes `sourceAssetIds` = source assets, not media items);
  only prompt prefills via URL. Full reference handoff needs the image-studio
  read side to consume `sourceMediaItems`.
