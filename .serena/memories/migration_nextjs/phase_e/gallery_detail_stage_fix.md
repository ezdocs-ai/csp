# Phase E — Gallery detail R3 presentation close (Next.js)

Date: 2026-07-29. Closes residual parity item **R3** from
`mem:migration_nextjs/phase_e/final_parity_review` ("Gallery detail does not
mount `<MediaLightbox>`; source-asset lightbox overlay not ported; share /
copy-link / see-more absent"). Supersedes the R3 verdict there; R3 is now
SHIPPED.

## Scope owned (only these touched)
- `frontend-next/src/features/gallery/components/gallery-detail.tsx` (edited).
- `frontend-next/src/components/media/lightbox.tsx` — REUSED AS-IS (no edit
  needed; already a modal shell delegating to studio MediaLightbox).
- `frontend-next/src/components/studio/media-lightbox.tsx` — CONSUMED, not
  edited (agent-owned primitive; used its `MediaLightbox` + `ActionsToolbar`
  + output-thumbnail strip + exported types).
- gallery tests/helpers: `gallery-actions.ts` + its tests UNCHANGED (intent
  builders already covered; no new non-trivial logic added here → no new test).
NOT touched: `gallery-actions.ts`, `gallery-view.tsx`, filters/templates/
workflow/admin, backend, Angular.

## Changes (gallery-detail.tsx only)
1. **Main stage → shared studio `<MediaLightbox>`.** Replaced the static
   `<img>`/`<MediaPlayer>` stage + the plain `<Button>` action row with a
   single `<MediaLightbox actions={actions} media={stageMedia} variant={variant} />`.
   - `stageMedia` now passes `urls` = ALL `media.presignedUrls` (not just
     `[0]`) → MediaLightbox renders its built-in output-thumbnail strip when
     >1 url (Angular-faithful multi-output stage). `posterUrl` =
     `presignedThumbnailUrls[0]`; `prompt`/`mimeType` forwarded.
   - `variant`: video / audio / image derived from `mimeType`.
   - Removes the `MediaPlayer` import (MediaLightbox owns its stage) and the
     `Button` import (action row gone; only `<button>`/`<Link>` remain).
2. **Action toolbar via `actions` (existing handlers preserved, no new
   mutations).** Toolbar auto-hides any slot whose handler is `undefined`, so
   gating is data-driven:
   - image: `edit`→buildImageRemix, `generateVideo`(position)→buildVideoStart/
     End (this restores Angular's single "Generate video" `<Menu>` with
     start/end items — MORE faithful than the prior two plain buttons the
     gallery_actions_fix memo deliberately used to dodge Menu nested-button
     styling; the studio primitive now owns that styling), `sendToVto`.
   - video: `editWithOmni`, `extendWithAi`, `concatenate`.
   - always: `download`→downloadZip([itemId]), `assignTags`→setTagOpen,
     `delete`→setConfirmDelete (ConfirmDialog + TagAssigner dialogs unchanged).
   - `share` → native Web Share API `navigator.share?.({url: location.href})`
     (guarded `?.` = graceful no-op where unsupported; no hydration mismatch
     because handler is always defined so the button renders consistently
     server+client). This is the ONE share/copy-link/see-more slot the
     existing primitive backs (ActionsToolbar has a `share` slot + browser
     native backing). copy-link has NO primitive slot → omitted (would invent
     a button). `seeMoreInfo` slot exists but is REDUNDANT on the detail page
     (Angular's navigated TO detail; we ARE detail) → omitted.
   - `actions` is `undefined` when `itemId` is null → no toolbar rendered.
3. **Source-asset local preview overlay (Angular `openSourceAssetInLightbox`
   ported).** Referenced-source-asset thumbnails (DetailsPanel →
   `enrichedSourceAssets`) changed from a non-interactive `<span>` to a
   `<button>` that sets `assetOverlay` state; renders the existing
   `media/Lightbox` modal (image/video/audio stage via signed URLs, NO action
   toolbar → pure preview, no invented buttons/mutations). Adapter
   `sourceAssetToMediaItem(asset): MediaItem` mirrors Angular's GalleryItem
   construction (id=assetId, itemType 'media_item', presignedUrls=[url],
   thumb fallback, metadata.mimeType/prompt=`Input: ${role}`). Audio source
   assets open the overlay too (studio stage renders native `<audio>` —
   better than Angular's graphic_eq icon + no-click). Source-MEDIA-item
   references unchanged (still `<Link>` to `/gallery/:id?img_index=N`).

## Preserved (untouched, per scope)
Detail tabs (Details/Technical/Debug + role=tablist), Parameters/Tags/
Grounding/Prompt/Style sections, TechnicalPanel, DebugPanel, ConfirmDialog,
TagAssigner, back-to-gallery `<Link>`, all `gallery-actions.ts` builders +
`stageRemix` sessionStorage carry, `MediaDetail`/`MediaItem` types.

## Validation
- diagnostics `gallery-detail.tsx`: 0 errors. Only pre-existing codebase-wide
  Tailwind v4 `[var(--tri-*)]` "can be written as `(--tri-*)`" style nits on
  UNTOUCHED lines + my new source-asset button classes which deliberately
  match the file's existing bracket-var convention (not a regression).
- `npx eslint src/features/gallery/components/gallery-detail.tsx`: exit 0
  (clean). (Repo pre-commit gts hooks target Angular `frontend/` only; do NOT
  cover `frontend-next/`. Only eslint + addlicense apply; Apache header
  intact/untouched.)
- `bun test src/features/gallery`: 30 pass / 0 fail (gallery-actions 11 +
  gallery-utils 19). gallery-actions.ts unchanged → intent coverage holds.
- NOT run (no infra): component render/jsdom, browser visual, docker. Static
  verification: re-read every edited region after write; JSX well-formed
  (diagnostics parses TSX).

## No new test rationale
New logic is: variant ternary, stageMedia field map, actions wiring of
ALREADY-TESTED builders, guarded native share, mechanical sourceAssetToMediaItem
adapter. None is non-trivial branching logic; the actual non-trivial logic
(intent builders) remains covered by gallery-actions.test.ts. Per lazy-dev
"trivial one-liners need no test" + repo has no React-render test infra.

## Cross-agent contract
NONE changed. `GalleryDetail({ media })` prop signature unchanged.
`media/lightbox.tsx` Lightbox + studio MediaLightbox consumed unchanged.
gallery page (`app/(studio)/gallery/[id]/page.tsx`) unaffected.

## Follow-ups (unchanged, not blockers)
- READ side for `sessionStorage["remixState"]` on /video + /vto still pending
  (gallery_actions_fix caveat): buttons navigate correctly, prefill deferred.
- Image-remix reference-image handoff still prompt-only via URL (image studio
  consumes sourceAssetIds, not media-item IDs) — unchanged.
