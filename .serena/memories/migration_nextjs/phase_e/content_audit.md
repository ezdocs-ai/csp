# Phase E — Read-only content parity audit

Scope: gallery list/detail, fun-templates list/use, brand-guidelines journey,
shared media-card / lightbox / filter behavior. Angular `frontend/` = source of
truth; `frontend-next/` = current implementation. Read-only; no edits made.
Prior memories `mem:migration_nextjs/parity_impl/gallery*` and
`mem:migration_nextjs/parity_routes/content` confirmed still accurate for their
stated scope but several P0/P1 gaps they DEFERRED are still open and now block
release. This audit supersedes the "deferred" lists in those memories for the
four in-scope journeys.

---

## P0 BLOCKERS (must fix before launch)

### B1. `/asset-detail/:id` route does not exist — source-asset cards 404
- Angular routes source-asset items to `/asset-detail/:id` (separate backend
  endpoint `/api/source_assets/:id`, distinct from `/api/gallery/item/:id` for
  media items). See `frontend/src/app/common/components/gallery-card/gallery-card.component.ts`
  L213-216 `getRoute()` and `frontend/src/app/gallery/gallery.service.ts`
  L196 `getAsset()`.
- Next has NO `/asset-detail` route handler anywhere
  (`find frontend-next/app -name '*asset-detail*'` empty).
- Yet Next's own code already builds that href:
  - `frontend-next/src/components/media/media-card.tsx` is consumed by
    `gallery-view.tsx` L180 with `href={... \`/gallery/${item.id}\`}` — always
    `/gallery/:id` regardless of `item.itemType` (WRONG for source_asset).
  - `frontend-next/src/features/admin/components/media-gallery-admin.tsx` L353
    correctly builds `/asset-detail/${item.id}` for source_asset → dead link.
- `frontend-next/app/(studio)/gallery/[id]/page.tsx` L18,24 has no itemType
  branch — `getMedia()` always calls `/api/gallery/item/:id`. Even if a route
 existed, the fetcher would still hit the wrong endpoint.
- Impact: clicking any source-asset card in user gallery or admin → 404 /
  wrong-shape response. Source assets appear in every workspace gallery.

### B2. Gallery `Pagination` wipes filters + workspaceId
- `frontend-next/src/components/media/pagination.tsx` L10:
  `const pageHref = (page) => \`?page=${page}\`;`
- Hard-coded URL drops every other search param. With `type`/`tags`/`owner`/
  `query`/`startDate`/`endDate` set, clicking Previous/Next/page number →
  `?page=N` only.
- `frontend-next/app/(studio)/gallery/page.tsx` L15-22 then sees no
  `workspaceId` → redirects to `/gallery?workspaceId=<default>` → user lands
  on page 1, default workspace, no filters. Full filter-then-paginate flow
  broken.
- Compare `frontend-next/app/(studio)/fun-templates/page.tsx` L25-29
  `pageUrl()` which preserves params via `new URLSearchParams(params)` —
  gallery pagination is the only broken one.

### B3. "Use template" → studios is a silent no-op
- `frontend-next/src/features/templates/components/use-template-button.tsx`
  pushes URL params `templateId`, `prompt`, `model`, `sourceMediaId`,
  `options` to `/`, `/video`, `/audio`, `/vto`.
- Receivers:
  - `frontend-next/app/(studio)/page.tsx` reads only `prompt` + `workspaceId`
    → `<ImageStudio initialState={{ prompt, workspaceId }}>`. Drops
    `templateId`/`model`/`sourceMediaId`/`options`. `ImageGenerationRequest`
    (`frontend-next/src/features/image-studio/types.ts` L23-43) supports
    `model`, `aspectRatio`, `style`, etc. — none hydrated.
  - `frontend-next/app/(studio)/video/page.tsx`, `vto/page.tsx`,
    `audio/page.tsx` accept ZERO searchParams; render `<VideoStudio/>` etc.
    with no props.
- Angular equivalent (`frontend/src/app/home/home.component.ts` L336-352)
  consumes `navigation.extras.state` with `templateParams` (full
  `GenerationParameters`) AND `sourceAssets` (`EnrichedSourceAsset[]`) AND
  separately `remixState` for gallery-derived reuse, then `applyTemplateParameters()`
  L517-560 applies prompt/numMedia/model/aspectRatio/style/lighting/colorAndTone/
  composition/negativePrompt/durationSeconds/originalPrompt.
- Result: model / aspect / source-assets / negative-prompt / etc. from any
  template (or any gallery remix action) are silently lost in Next. Only
  image-studio prompt survives.

### B4. Gallery "Copy to workspace" bulk action is a no-op
- `frontend-next/src/features/gallery/components/bulk-actions.tsx` L18:
  `else if (next === "copy") setAction(next);` — no UI consumes
  `action === "copy"`. No dialog opens, no mutation fires.
- The mutation exists but is never called:
  `frontend-next/src/features/gallery/hooks/use-gallery-mutations.ts` L27
  `copyMedia: (ids, workspaceId) => call("copy", { mediaIds: ids, workspaceId })`.
- `frontend-next/src/features/gallery/components/selection-bar.tsx` L7
  renders the "Copy to workspace" button — appears active, click is silent.
- Angular parity: `frontend/src/app/gallery/media-gallery/media-gallery.component.ts`
  L548-586 `copySelected()` + `performCopy()` opens workspace-picker dialog
  (`MatDialog` `confirm-workspace.component`) then POSTs copy.

### B5. Gallery detail action toolbar never wired
- `frontend-next/src/features/gallery/components/gallery-detail.tsx` L30-125
  renders a static `<img>` or `<MediaPlayer>` for the stage. Does NOT use
  `<MediaLightbox>`.
- The shared `frontend-next/src/components/studio/media-lightbox.tsx` is
  fully built (L44-70 `MediaLightboxActions`: edit, generateVideo,
  sendToVto, editWithOmni, extendWithAi, concatenate, delete, seeMoreInfo,
  share, download, assignTags) with `ActionsToolbar` L226-313 — just never
  invoked from gallery detail.
- Angular `frontend/src/app/gallery/media-detail/media-detail.component.html`
  L53-62 wires `<app-media-lightbox>` with 8 `@Output()` handlers
  (`editClicked`, `generateVideoClicked`, `sendToVtoClicked`,
  `extendWithAiClicked`, `concatenateClicked`, `editWithOmniClicked`,
  `deleteClicked`, `tagsChanged`). All route to a studio with
  `router.navigate([...], { state: { remixState } })` — see
  `media-detail.component.ts` L312-478.
- Also missing: source-asset lightbox overlay
  (`openSourceAssetInLightbox` L480-516 + html L646-659) — clicking a
  referenced source-asset thumb in the right panel opens an inline
  lightbox in Angular; Next renders only a static `<img>`.
- Note: full B5 fix depends on B3 plumbing (studios must accept incoming
  remix state) — otherwise actions navigate to studios that can't consume
  the carry.

---

## P1 HIGH (functional parity gaps, fix before parity sign-off)

### H1. Brand-guidelines journey thin
Page route `/settings/brand-guidelines` (linked from `workspace-switcher.tsx`
L165) is an acceptable redesign of Angular's dialog, but the page is missing
most Angular capabilities:

| Angular (`brand-guideline-dialog.component.*`) | Next (`brand-guideline-upload.tsx`) |
|---|---|
| Initial load by workspace (`getBrandGuidelineForWorkspace`) | None — `useBrandGuideline(id)` polls only after upload; pre-existing workspace guideline invisible |
| View mode: color-palette swatches (`colorPalette`, `[style.backgroundColor]`) | None |
| View mode: tone-of-voice + visual-style summaries as **markdown** with expand/collapse | Plain `<p>` text, no markdown, no expand |
| Source PDFs list (`presignedSourcePdfUrls`) with `picture_as_pdf` icons | None |
| Replace flow (`replaceGuideline()`) | None |
| Delete button (`onDelete()` → service `deleteBrandGuideline`) | None — `DELETE /api/brand-guidelines/:id` route exists (`app/api/brand-guidelines/[id]/route.ts`) but no UI |
| Edit gating (`canPerformEditActionsOnBrandGuidelines` — admin OR workspace-perm) | None — any authenticated user can upload; delete would be ungated if added |
| Workspace-switcher menu: disabled + inline spinner during PROCESSING (`workspace-switcher.component.html` L70-94) | Static icon-only menu item (`workspace-switcher.tsx` L165) |

- Markdown rendering: project has no markdown dep yet (need to confirm —
  `react-markdown` / `marked` not in `package.json` from a quick scan).

### H2. Fun-templates contract mismatch
- Angular consumes `/api/media-templates` expecting `MediaTemplate[]`:
  `id: number`, `name`, `description`, `mimeType: MimeTypeEnum`,
  `industry: IndustryEnum`, `tags: string[]`, `gcsUris`, `thumbnailUris`,
  `presignedUrls`, `presignedThumbnailUrls`, `enrichedSourceAssets`,
  `generationParameters` — see `frontend/src/app/fun-templates/media-template.model.ts`
  L136-150. Card uses an auto-slideshow of `presignedUrls`.
- Next `frontend-next/src/features/templates/types.ts` declares
  `TemplateListItem { id: string; name; description?; industry?; model?;
  thumbnailUrl?; tags? }` and `TemplateDetail` adding `prompt?`,
  `options?: Record<string, unknown>`, `mediaType?`, `sourceMediaId?`.
- The list and detail pages (`frontend-next/app/(studio)/fun-templates/page.tsx`
  L8, `frontend-next/app/(studio)/fun-templates/[id]/page.tsx` L18) read
  `response.items ?? response.data` and `thumbnailUrl` — fields that don't
  exist on the Angular-defined `MediaTemplate` shape. **OpenAPI / backend
  controller response shape unverified** — likely mismatch.
- The fun-template card (`template-card.tsx`) renders a single
  `next/image` of `template.thumbnailUrl`. Angular `fun-templates.component.html`
  L199-285 renders full slideshow (`<video>` for VIDEO, multi-image carousel
  for IMAGE, equalizer for AUDIO) with hover-to-play + chevron navigation.
- Detail page route `/fun-templates/:id` doesn't exist in Angular —
  intentional Next redesign, but the redesign isn't consulted in
  `mem:migration_nextjs/parity_routes/content` so it's an unreviewed
  deviation.

### H3. Fun-templates filter set mismatch
| Angular (`fun-templates.component.ts` L42-48, `applyFilters` L149-201) | Next (`template-filters.tsx` L7) |
|---|---|
| `industry` (dropdown of `IndustryEnum`) | `industry` (free-text input) |
| `mediaType` (dropdown of `MimeTypeEnum`) | **missing** |
| `tags` (search-within-tags) | **missing** |
| `name` (substring search) | replaced by `q` (non-Angular key) |
| `model` (substring on `generationParameters.model`) | `model` (free-text input, server-side) |

---

## P2 MEDIUM (visual / behavioral deltas — non-blocking)

### M1. Gallery `Filters` thinner than Angular (already deferred, restated)
`frontend-next/src/components/media/filters.tsx` deferred (per
`mem:migration_nextjs/parity_impl/gallery_filters_detail`):
Generation Model dropdown, Asset Type dropdown, "My tags" / "Select only my
media" checkboxes, searchable paginated tags multi-select + admin gear
(`openTagsManagement()`).
Hard dependency: `Filters` has zero props — session email + activeWorkspaceId
must be threaded via `gallery-view.tsx` (owned by another agent) to support
"only my media" / "my tags".

### M2. Gallery detail "Prompt Details" + Lineage tabs missing
Angular has a second tab "Prompt Details" rendering `rewrittenPrompt`,
`negativePrompt`, raw JSON prompt, and a structured prompt-decomposition
(metadata, scene_setup, subject, visual_style, camera_directives, timeline,
constraints, final_summary_prompt). See
`frontend/src/app/gallery/media-detail/media-detail.component.html` L296-540
and `parsePrompt()` L205-225 in the component. Next has 0 of this. Source
of `promptJson` (the parsed object) unverified — `formattedPrompt` getter
L245-257 suggests it comes from the mediaItem but the field name needs
confirmation against `MediaItemResponse`.

### M3. Gallery detail `identityFields` panel missing
Angular `MediaDetailComponent.identityFields` (component L60-146) feeds an
expandable identity panel rendered inside `<app-media-lightbox>`. Status /
mimeType / aspectRatio / resolution always; expandable row adds Model /
Created At / Created By / Generation Time / voice / language / seed /
numMedia / duration / googleSearch / originalPrompt / prompt. Not ported
to Next (would naturally attach to `<MediaLightbox>` once B5 wires it).

### M4. Tag color + filter-highlight lost in `media-card.tsx`
- Angular `gallery-card.component.html` L131:
  `[style.--tag-color]="tag.color || '#E8EAED'"`.
- Angular `displayedTags` getter (component L251-270) filters by
  `filteredTags` input so the card shows only the tags the user is filtering
  by.
- Next `media-card.tsx` L66-78 `budgetTags` ignores `tag.color` and any
  selection. Result: no per-tag colors, no filter-highlight.

### M5. Pagination model + selection persistence diverges
- Angular `media-gallery.component.ts` L419 `loadMore()` increments an
  `offset` and **accumulates** `images[]` client-side; selection persists
  across loads.
- Next uses page-based `<Pagination>`; clicking a `<Link>` is a full
  navigation → `GalleryView` client state (including `selected` Set) is
  lost on page change.
- Side effect: `groupMediaByDate(media)` in
  `frontend-next/src/features/gallery/components/gallery-view.tsx` L137
  groups only the current 24-item page, so date headers (Today / Yesterday
  / week ranges / Month YYYY) re-render differently per page; Angular
  groups across the accumulated list.

### M6. Fun-templates grid breakpoint mismatch
- Angular `fun-templates.component.html` L144:
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- Next `template-grid.tsx` L8:
  `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- 2-col step happens at 640px (Angular) vs 768px (Next).

---

## PROPOSED WRITE SET (P0 + P1 only — blockers)

Each item lists exact files. No edits performed in this audit.

### B1 — Add asset-detail route + per-item href
- NEW `frontend-next/app/(studio)/asset-detail/[id]/page.tsx`
  - server component; `requireUser()`; fetch
    `/api/source_assets/:id`; map response to `MediaDetail` shape (Angular
    `getAsset()` L196-215 in `gallery.service.ts` shows the field-mapping
    needed: gcsUris/gcsUri, thumbnailUris/thumbnailGcsUri, itemType=
    'source_asset'); render `<GalleryDetail media={...} />` (or a thin
    SourceAssetDetail if shape diverges too far).
  - Add `error.tsx` + `loading.tsx` siblings mirroring gallery.
- EDIT `frontend-next/src/features/gallery/components/gallery-view.tsx`
  around L180: compute per-item href:
  `const href = item.itemType === 'source_asset' ? \`/asset-detail/${item.id}\` : \`/gallery/${item.id}\`;`
- No change needed in `media-card.tsx` (already accepts `href` prop) or in
  `media-gallery-admin.tsx` (already builds correct href; will resolve once
  route exists).

### B2 — Fix gallery pagination param preservation
- EDIT `frontend-next/src/components/media/pagination.tsx`
  - add `"use client";` + `useSearchParams()` from `next/navigation`;
  - replace `pageHref` body to construct via
    `new URLSearchParams(searchParams).set("page", String(page))` and
    return `?${params.toString()}` (mirror `template-filters.tsx` L13-19
    pattern).
- No prop/API change for callers.

### B3 — Plumb template + remix state into studios
- EDIT `frontend-next/app/(studio)/page.tsx`
  - extend `searchParams` type with `model`, `aspectRatio`, `style`,
    `lighting`, `colorAndTone`, `composition`, `negativePrompt`, `numMedia`,
    `durationSeconds`, `templateId`;
  - pass into `<ImageStudio initialState={{ prompt, workspaceId, model,
    aspectRatio, style, ... }}>` (all fields already on
    `ImageGenerationRequest`).
- EDIT `frontend-next/app/(studio)/video/page.tsx` (and `audio/page.tsx`,
  `vto/page.tsx`): read `searchParams`, pass to `<VideoStudio
  initialState={...} />` etc.
- EDIT each studio's `initialState` prop type to accept the new fields
  (likely already partially supported via existing hooks — verify
  `useImageState` etc.).
- For richer carry (source-asset arrays, structured options): add a tiny
  sessionStorage contract — e.g. `sessionStorage.setItem("csp:template",
  JSON.stringify({ sourceAssets, options }))` keyed by `templateId` URL
  param; studios read on mount. Avoids URL-encoding arrays.
- Verify scope with lead before doing sessionStorage route — Angular uses
  imperative `router.state` which has no Next equivalent.

### B4 — Wire copy-to-workspace
- NEW `frontend-next/src/features/gallery/components/copy-to-workspace-dialog.tsx`
  - workspace picker (reuse `<Dialog>` + workspace list hook used by
    `WorkspaceSwitcher`);
  - on confirm call `copyMedia(selection, workspaceId)` from
    `use-gallery-mutations.ts` L27 then `onSuccess`.
- EDIT `frontend-next/src/features/gallery/components/bulk-actions.tsx`
  - import dialog; add `action === "copy"` branch opening dialog;
  - thread `onSuccess` (already in scope).

### B5 — Mount `<MediaLightbox>` in gallery detail with full action toolbar
- EDIT `frontend-next/src/features/gallery/components/gallery-detail.tsx`
  - replace L62-79 stage block with
    `<MediaLightbox variant={variantOf(mimeType)} media={stageMedia}
    actions={actions} />` (variant helper exists in
    `components/media/lightbox.tsx` L11-16);
  - build `actions` object wiring each callback to `router.push` with URL
    params + sessionStorage carry (depends on B3 plumbing being in place);
  - re-add source-asset lightbox overlay (`selectedAssetForLightbox` state
    + overlay JSX) mirroring Angular html L646-659.
- Depends on: B3 (studios receiving state).

### H1 — Brand-guidelines page parity
- EDIT `frontend-next/src/features/brand-guidelines/hooks/use-brand-guideline.ts`
  - add `useBrandGuidelineByWorkspace(workspaceId)` that GETs
    `/api/brand-guidelines/?workspaceId=:id` on mount.
- EDIT `frontend-next/src/features/brand-guidelines/components/brand-guideline-upload.tsx`
  - call the workspace-by-id hook on mount (replace `current?.id ?? null`
    polling source with the workspace-level guideline);
  - add color-palette swatches block;
  - add source-PDFs list block;
  - add markdown rendering for toneOfVoice / visualStyle summaries with
    expand/collapse — NEW dep (suggest `react-markdown`; verify with lead);
  - add Delete button (gated) + Replace flow; wire to
    `DELETE /api/brand-guidelines/:id`;
  - gate edit actions by role (admin or workspace-permission) — session
    plumbing via `useWorkspace()` + session hook.
- EDIT `frontend-next/src/features/workspaces/components/workspace-switcher.tsx`
  around L165: surface processing state on the Brand Guidelines menu item
  (subscribe to active job, disabled + inline spinner while PROCESSING).

### H2 — Fun-templates contract alignment (needs lead decision first)
- VERIFY backend response shape: read `MediaTemplatesController`
  (`backend/src/.../media_template_controller.py`) + DTO. Confirm field
  names returned by `GET /api/media-templates` and `GET /api/media-templates/:id`.
- DECIDE: keep Next's detail-page redesign OR restore Angular's modal
  lightbox (`selectedTemplateForLightbox` flow in
  `fun-templates.component.ts` L284-338).
- EDIT `frontend-next/src/features/templates/types.ts` to match actual
  response (likely: `mimeType`, `industry: IndustryEnum`, `gcsUris`,
  `presignedUrls`, `presignedThumbnailUrls`, `enrichedSourceAssets`,
  `generationParameters` — same as Angular `MediaTemplate`).
- EDIT `template-card.tsx` + `template-grid.tsx` to render multi-output
  slideshow with mime-aware stage (image carousel / video / audio), parity
  with Angular html L199-285.
- EDIT `use-template-button.tsx` to push full `generationParameters` +
  `enrichedSourceAssets` carry (B3 plumbing).

### H3 — Fun-templates filter parity
- EDIT `frontend-next/src/features/templates/components/template-filters.tsx`
  - replace `q` with `name`;
  - add `mediaType` dropdown (IMAGE/VIDEO/AUDIO → backend wildcard values);
  - add `tags` substring input.
- Verify server `fun-templates/page.tsx` forwards these to backend (it
  currently passes through any `sp` key — likely already works).

---

## VERIFICATION NOTES
- Pure read-only audit: `read_file`, `grep`, `list_directory`, `terminal`
  (read-only `sed`/`grep`/`find`/`wc`). No code edits, no runtime commands.
- All file paths + line numbers re-verified against current tree (waves 2-3
  changes incorporated).
- Backend endpoints confirmed via `backend/src/source_assets/source_asset_controller.py`
  L45-46 (`prefix=/api/source_assets`), `backend/src/galleries/dto/gallery_search_dto.py`
  L30, `backend/src/common/base_dto.py` L23-40 (`MimeTypeEnum` +
  `WildcardMimeTypeEnum` accept `image/*` etc.).
- Open items needing follow-up verification (not blockers per se):
  1. Actual `/api/media-templates` response field names (H2).
  2. Whether `react-markdown` or equivalent is already a dependency (H1).
  3. Whether `MediaItemResponse` schema carries `promptJson`-equivalent
     field for M2.
