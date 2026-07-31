# Content surfaces parity — Angular source of truth vs Next

Scope owner: Content Code Analyst (read-only). Evidence = code only, no browser.
Read `mem:migration_nextjs/ui_ux_parity_recovery` and `mem:migration_nextjs/ui_ux_parallel_agents` first. This memory covers gallery (list + detail), fun-templates (list + detail), media primitives, and brand-guidelines settings. Lightbox/media-player/cards are shared between surfaces.

Legend: ✅ verified by reading file · ⚠️ inferred from outline/listing · ❌ not read.

## Shared primitives (Angular → Next mapping)

### Gallery card
- Angular: `frontend/src/app/common/components/gallery-card/gallery-card.component.{ts,html,scss}` ✅
- Next: `frontend-next/src/components/media/media-card.tsx` ✅
- Angular anatomy (verified):
  - Root `card-root` with `selected` / `any-selected` state classes, glassmorphism selection-indicator top-left (28px circle, blur 8px), gradient blue/green when selected, scale-on-hover.
  - Media layering: absolute stacked `<img>`/`<video>` with `.active`/`.inactive` opacity crossfade; `.inactive` is `opacity:0; pointer-events:none`.
  - Aspect handling via `.spacer` div with computed `padding-bottom` from `aspectRatio` string. Thresholds: ratio>=2 → 2:1 wide (col-span-2 in grid), ratio<=0.5 → 1:2 tall (200% pad), audio → 2:1, default 1:1.
  - Video: poster thumbnail by default + play SVG overlay (50% opacity black, fades on hover); on `mouseenter` swaps to autoplaying muted loop `<video>` per URL slot. No native controls.
  - Audio: dark `#2a2a2e` tile with 80px `graphic_eq` icon, pulse animation on hover.
  - Carousel controls: prev/next circular buttons + dot indicator, opacity 0 until `.card-root:hover`.
  - Tags chip set bottom-centered, glassmorphism, truncates to ~20 chars with "+N more" chip.
  - Gallery-item-overlay top-left: gemini-spark SVG for `media_item`, `cloud_upload` icon for `source_asset`.
  - Click behavior: selection mode or any-selected → toggles selection and prevents navigation; otherwise `<a routerLink>` to `/gallery/:id` or `/asset-detail/:id` with router `state={mediaItem}`.
  - `filteredTags` input filters visible chips.
- Next `MediaCard` deltas:
  - **layout mismatch**: fixed `aspect-[4/3]` instead of aspect-ratio-driven spacer; no 2:1 wide / 1:2 tall / audio 2:1 handling.
  - **missing**: selection-indicator glass circle, hover-to-play video swap, play overlay, audio tile + pulse, carousel prev/next/dots, tag chips with +N more, item-type overlay icon, crossfade layering.
  - **behavior mismatch**: `mediaType()` returns string label but card never hides native controls or swaps to `<video>` on hover; `title` falls back to `originalFilename` (often missing) instead of `prompt`-derived short prompt (Angular `getShortPrompt` parses JSON `prompt_name`).
  - **state mismatch**: `selected` only adds ring; no `any-selected` mode that converts click→select.
  - Severity: **CRITICAL — structural rebuild**. Restyle is insufficient; card composition (absolute media stack + spacer + hover swap + selection model) is wrong.
- Logic to preserve in Next card: `MediaItem` type alias to `UnifiedGalleryItemResponse`; `href`/`onSelect`/`selected` prop contract used by `GalleryGrid`. Keep type, rewire body.

### Lightbox / media preview
- Angular: `frontend/src/app/common/components/media-lightbox/media-lightbox.component.{ts,html}` ✅ (ts outline + L50-172; html L1-253). Share menu SVG block L254-450 ❌ not read.
- Next: `frontend-next/src/components/media/lightbox.tsx` ✅
- Angular anatomy (verified):
  - Two main areas: `main-media-container` (image / video / audio stage) + `bottom-controls` (thumbnails strip + action toolbar).
  - Image: PhotoSwipe v4 lightbox integration for zoom (initializePhotoSwipe, `img_index` query param sync via `updateUrlWithImageIndex`); `ngSrc` priority image fill.
  - Video: native `<video controls muted>` with poster; click toggles play.
  - Audio: custom player — hidden `<audio>` + play/pause circle, current time / duration, mat-slider seek; resets on ended.
  - Thumbnails row with `selectMedia(i)` + audio thumb variant (graphic_eq + track number); tooltip "Track N" for audio.
  - Action toolbar (circle studio-buttons, icon-only with matTooltip): Edit (image only), Generate video (image only, split menu start/end image), VTO (image only), Share (toggle share menu), Download (spinner state), See more info, Assign tags, Delete (input-gated), Omni edit / Extend / Concatenate (video only).
  - Share menu overlay (Twitter, Facebook, LinkedIn, Reddit, WhatsApp, Telegram, Email, Copy link) with `getShareUrl`/`copyLink` snackbar.
  - Inputs: `mediaItem`, `initialIndex`, `showSeeMoreInfoButton`, `showShareButton`, `showDownloadButton`, `showDeleteButton`.
  - Outputs: editClicked, generateVideoClicked `{role,index}`, sendToVtoClicked, editWithOmniClicked/extendWithAiClicked/concatenateClicked `{mediaItem,selectedIndex}`, deleteClicked, tagsChanged.
- Next `Lightbox` deltas:
  - **missing**: PhotoSwipe zoom, thumbnail strip, action toolbar (edit/video/vto/share/download/info/tags/delete/omni/extend/concatenate), share menu, custom audio player with seek slider, `img_index` URL sync, per-input show/hide flags.
  - **behavior mismatch**: Next uses single `presignedUrls[0]`; Angular honors `initialIndex` + query param + thumbnail switching. Next keyboard has Escape + arrows; Angular delegates arrows to PhotoSwipe.
  - **layout mismatch**: Next is a centered modal with overflow auto; Angular is an inline media stage with bottom controls (used both inline on detail page and inside fixed overlay for asset lightbox).
  - Severity: **CRITICAL — structural rebuild**. Current `Lightbox` is a minimal preview, not the Angular media stage.
- Logic to preserve: Next `LightboxProps` (`onNavigate` previous/next, `onClose`, Escape/arrow key handler, focus close button). Keep a11y shell; rebuild interior.

### Media player
- Angular: inlined in media-lightbox (video + custom audio). No standalone.
- Next: `frontend-next/src/components/media/media-player.tsx` ✅ — native `<audio controls>` / `<video controls poster>`.
- Delta: **behavior mismatch** — Angular audio player is custom (play circle + slider + time). Decision: keep Next `MediaPlayer` for video; audio needs custom UI to match. Severity **MEDIUM**.

### Filters
- Angular: `frontend/src/app/common/components/studio-{search-filter,date-range-filter,dropdown}` referenced from media-gallery ❌ component bodies not read; behavior inferred from media-gallery html/ts ✅.
- Next: `frontend-next/src/components/media/filters.tsx` ❌ NOT READ (cancelled).
- Angular gallery filter anatomy (verified from media-gallery html):
  - **Permanent row**: search-filter (96rem on md+), date-range-filter, "Filters" toggle button (primary, small, icon `filter_list`/`expand_less`), "Select All / Deselect All" button right-aligned.
  - **Collapsible advanced row** (`showAdvancedFilters`, `[@fadeSlideInOut]` animation): Media Type dropdown, Generation Model dropdown (cascaded — resets when media type changes), Asset Type dropdown, Tags multi-select dropdown (searchable, deletable, paginated `displayedTagOptions` with "load more", "My tags" checkbox, admin gear button → tags management dialog).
  - **Checkbox row**: "Select only my media".
  - Defaults: `mediaTypeFilter=''`, `onlyMyTags=true`, `onlyMyMedia=false`, page size 40, status `COMPLETED`.
  - Query rewriting: `@` in search → userEmail; else `query` field.
- Next `Filters` component: **UNVERIFIED** — must be read before rebuild. Severity **HIGH (presumed)**.

### Pagination / infinite scroll
- Angular: `MediaGalleryComponent` uses **manual "Load more" button** + `IntersectionObserver` scroll loader; `GalleryService` pageSize=40, appends pages, `allImagesLoaded` flag. Items grouped by date (Today / Yesterday / week ranges / month).
- Next: `frontend-next/src/components/media/pagination.tsx` ❌ NOT READ; `infinite-loader.tsx` ❌ NOT READ; gallery `page.tsx` uses `Pagination` with `pageSize=24` and offset paging.
- Delta: **behavior mismatch** — Angular groups by date with date headings; Next renders flat list with fixed aspect tiles. "Load more" vs numbered pagination differs. Severity **HIGH**.
- Logic to preserve: Next server pagination contract (`response.page`, `response.totalPages`, URL `page` param). Keep API client, change UI.

## Surface: Gallery list `/gallery`

- Angular route unguarded; component `MediaGalleryComponent`. Files: `frontend/src/app/gallery/media-gallery/media-gallery.component.{ts,html,scss}` ✅; service `frontend/src/app/gallery/gallery.service.ts` ✅.
- Next route: `frontend-next/app/(studio)/gallery/page.tsx` ✅, `loading.tsx` ✅, `error.tsx` ✅.
- Angular behavior (verified):
  - Hero header: animated gradient blob (`gradient-bg` with `feGaussianBlur`+`feColorMatrix` "goo" filter, 5 gradient divs + interactive cursor bubble), desktop headline "Creative Studio Media Gallery" + subtitle, mobile variant with `mobile-white-gemini-spark-icon`.
  - Container `--max-container-width:1400px`, `margin-left: max(calc(5vw + 4.5rem), calc(50% - 1400px/2))`, `margin-top: calc(10vh)`, padding `20px 40px`.
  - Grid: `grid-cols-2 md:grid-cols-4 gap-4 grid-flow-dense` with `[class.col-span-2]="isWide(media)"` — masonry-like dense fill.
  - Items grouped by date: Today / Yesterday / "Mon D - D" (≤60d weekly) / "Month YYYY" (>60d). Each group has `<h2>` title + grid.
  - Selection model: `Set<string>` with single click toggle, **Shift+click range select** (`lastSelectedIndex`), Ctrl/Cmd+click additive, Esc clears all. One-time snackbar hint `gallery_features_hint_seen` localStorage.
  - Bulk bar appears above grid when `selectedItems.size>0`: "{N} items selected" + icon-only circle buttons (copy / tag / download / delete) each with spinner state and tooltip.
  - States: full-page spinner on first load; inline spinner on page load; "Load more" button; "You've reached the end"; "No media items found" / "No {type} media items found" (empty). Error → console only (service swallows).
  - Routing carry: gallery card uses router `state={mediaItem}` to pass full item into detail.
- Next `GalleryPage` behavior (verified):
  - Plain header `<p>Media library</p><h1>Gallery</h1>`, no hero/gradient.
  - `Filters` (unverified) + flat `GalleryGrid` + numbered `Pagination`. pageSize=24.
  - `GalleryGrid` (verified): `grid-cols-1 md:grid-cols-12` with hardcoded `index===0 → md:col-span-8`, `index===1 → md:col-span-4`, rest `md:col-span-4`. **Not** aspect-driven, not date-grouped.
  - No selection model wired in page; `useSelection`/`BulkActions`/`SelectionBar` exist in feature dir but page.tsx does not import them (orphaned presentation).
  - States: `loading.tsx` = 6 aspect-[4/3] pulse tiles; `error.tsx` = EmptyState + Retry. No "reached end" / empty-with-filter-type messaging.
  - Server fetch via `getServerApiClient().post('/api/gallery/search', JSON.stringify(request))` — preserve.
- Deltas:
  1. **missing** — hero gradient header, mobile variant (CRITICAL).
  2. **layout mismatch** — container max-width/margins differ (Next uses `--tri-layout-wide` + `--tri-layout-gutter`); Angular uses sidebar-aware asymmetric margin. Depends on shell layout token. (HIGH, **shared prerequisite: shell/content width token** — see Shell agent.)
  3. **layout mismatch** — no date grouping; grid uses fixed positional col-spans instead of aspect-driven `col-span-2` for wide items; no `grid-flow-dense`. (CRITICAL.)
  4. **behavior mismatch** — numbered pagination vs "Load more" + scroll observer. (HIGH.)
  5. **missing** — selection model, Shift+range, Esc-to-clear, hint snackbar. (CRITICAL.)
  6. **state mismatch** — `MediaCard` ignores selection; bulk bar not mounted in page. (CRITICAL.)
  7. **missing** — admin tags-management entry point from filter row. (MEDIUM.)
  8. **behavior mismatch** — Next search params drive `userEmail` from `owner` param, no `@`-detection. (LOW.)
  9. **state mismatch** — Next defaults `status=undefined` (no COMPLETED filter); Angular defaults `status=COMPLETED` and `onlyMyTags=true`. (MEDIUM.)
- Logic to preserve: `getServerApiClient`, `listWorkspaces`, redirect-to-canonical-workspaceId block, `GallerySearch` type, `GalleryResponse` shape, `request` building from searchParams. **Keep `gallery/page.tsx` server fetch and redirect; replace JSX.**

## Surface: Gallery detail `/gallery/:id` (and `/asset-detail/:id`)

- Angular: `MediaDetailComponent` files `frontend/src/app/gallery/media-detail/media-detail.component.{ts,html,scss}` ✅ (html L17-300 + L540-660; middle prompt/identity/lineage tabs L300-540 ❌ not read; scss ❌). Uses `MediaLightboxComponent` + 4-tab `mat-tab-group`.
- Next: `frontend-next/app/(studio)/gallery/[id]/page.tsx` ✅; no `loading.tsx`/`error.tsx` present (only `gallery/error.tsx` covers).
- Angular behavior (verified):
  - Top-right header: "Go to Gallery" back button (gray), admin-only "Create Template" indigo button (calls `createTemplateFromMediaItem` → navigates to nonexistent `/templates/edit/:id` — flagged as orphan in parity_matrix).
  - Layout `grid-cols-1 lg:grid-cols-3 gap-8`: left `lg:col-span-2` hosts `MediaLightbox` (max-height 80vh) with all action outputs wired (edit→image remix, generateVideo→video route with start/end, vto, omni edit, extend, concatenate, delete, tagsChanged).
  - Right `lg:col-span-1` has `<h2>Details</h2>` + tab group (Details / Prompt Details (conditional on `promptJson`) / Lineage / Technical / Debug (conditional)).
  - **Details tab** (verified): Parameters section with creator avatar + email (matTooltip), Model, Created At (medium date), Generation Time (sec), Voice, Language, Seed, NumMedia, Duration, AspectRatio, Resolution, GoogleSearch; Tags chip section; Grounding (search queries chips, source links, search entry point safe HTML); Prompt section with expand/collapse (`isPromptExpanded`, 20-word truncate); Referenced Assets thumbnails linking to `/asset-detail/:id` / `/gallery/:id?img_index=N`; Style section (Image Style / Lighting / Color&Tone / Composition + modifiers chips).
  - **Technical tab** (verified): File Info (mime, watermark), Storage (GCS URI links via `getGcsLink`), Other (comment, critique).
  - **Debug tab** (verified, conditional): errorMessage (red), rawData JSON `<pre>`, audioAnalysis JSON `<pre>`.
  - Source-asset lightbox overlay: fixed `bg-black/80 z-[1000]`, `MediaLightbox` with `showSeeMoreInfoButton=false`, `showShareButton=false`, `showDownloadButton=true`, close button top-right.
- Next `GalleryDetailPage` behavior (verified):
  - Calls `getServerApiClient().get('/api/gallery/item/:id')`; `ApiError 404 → notFound()`. Server fetch + redirect preserved.
  - Renders `<GalleryDetail media={media} />` only — no layout tabs, no action wiring.
- Next `GalleryDetail` (verified) deltas:
  1. **missing** — back button, admin Create Template button, tab hierarchy. (CRITICAL.)
  2. **missing** — entire Lightbox action toolbar wiring (edit/video/vto/omni/extend/concatenate/delete/tags). The detail renders plain `<Image>` or `<MediaPlayer>`, not the lightbox stage. (CRITICAL.)
  3. **missing** — Tabs: Prompt Details, Lineage, Technical, Debug; all metadata sub-sections; grounding; referenced assets; style/modifiers. (CRITICAL.)
  4. **behavior mismatch** — placeholder disabled buttons "Remix/Edit/Video/VTO/Template" instead of working actions. (CRITICAL.)
  5. **missing** — source-asset lightbox overlay. (HIGH.)
  6. **missing** — `loading.tsx`/`error.tsx` for `[id]` segment. (MEDIUM.)
- Logic to preserve: server fetch in `gallery/[id]/page.tsx`, `MediaDetail` type, `ApiError` 404 handling, `generateMetadata`. **Keep page server shell; replace `GalleryDetail` body and mount shared lightbox.**
- Blocker: Angular detail action routing carries rich router `state` (remix context, source media items, preview URLs). Next has no equivalent — needs URL params or short server session per parity_matrix state persistence audit. **Decision required from lead** before wiring edit/video/vto/omni/extend/concatenate navigation.

## Surface: Fun Templates list `/fun-templates`

- Angular: `frontend/src/app/fun-templates/fun-templates.component.{ts,html,scss}` ✅; `media-template.model.ts` ❌ not read; `MediaTemplatesService.getMediaTemplates()` (under `admin/media-templates-management/`) ❌ not read.
- Next: `frontend-next/app/(studio)/fun-templates/page.tsx` ✅, `loading.tsx` ✅, `error.tsx` ✅, `[id]/page.tsx` ✅.
- Angular behavior (verified):
  - Same hero gradient header pattern as gallery ("Creative Studio Fun Templates", mobile variant).
  - Filter row: `mat-form-field outline` Industry select, Media Type select, Search-by-Name input (live `(input)` → `applyFilters`), "Clear Filters" stroked button. All filtering client-side on `allTemplates` (no server round-trip per filter change). `industries` derived from data.
  - Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`. Template card:
    - Top media area: image crossfade stack OR video-on-hover (poster thumb + play overlay → autoplaying muted loop), aspect ratio from `generationParameters.aspectRatio` (default 1:1 image / 16:9 video), per-template `currentImageIndices` with 3s **auto-slide interval** that pauses on hover.
    - Carousel prev/next + dots (image and video variants).
    - Top-right hover "expand" SVG icon (pointer-events-none).
    - Source-assets overlay bottom-left: rounded 48px thumbs with role tooltip, click → lightbox (stops propagation).
    - Card body: `<h3>` name, brand chip (gray) + industry chip (color-coded per `industryColorMap`), mime-type pill (blue for video, purple for image), description, tags chip list (first 5).
    - "Use Template" button (black/50 pill) appears on hover → `router.navigate(['/'] or ['/video'], {state:{templateParams, sourceAssets}})`.
  - Empty state: `<ng-template #noResults>` "No templates found matching your criteria." + Reset Filters button.
  - Lightbox overlay reuses `MediaLightbox` with `showSeeMoreInfoButton=false`, `showShareButton=false`, `showDownloadButton=true`.
- Next `Page` behavior (verified):
  - Server fetch `/api/media-templates` with searchParams; renders `<TemplateFilters />` + `<TemplateGrid templates={...} />` + numbered Previous/Next nav.
  - `TemplateFilters` / `TemplateGrid` (in `frontend-next/src/features/templates/components/`) ❌ NOT READ.
  - `loading.tsx` = 8 aspect-video pulse cards; `error.tsx` = message + Try again.
- Deltas (pending verification of Next feature components):
  1. **missing** — gradient hero header + mobile variant. (CRITICAL.)
  2. **behavior mismatch** — server-side filter/pagination vs Angular client-side filter over single fetch. May or may not be acceptable; defaults differ. (HIGH.)
  3. **missing** — template card auto-slide, video-on-hover, carousel controls, source-assets overlay, industry color coding, "Use Template" hover pill, expand SVG. Presumed because `MediaCard` (the only card primitive read) lacks these; verify against `template-card.tsx`. (CRITICAL — pending read.)
  4. **layout mismatch** — Next uses `TemplateGrid` (unverified) likely plain responsive grid; Angular has aspect-ratio spacer + layered media. (HIGH — pending read.)
  5. **behavior mismatch** — "Use Template" needs to carry `templateParams` + `sourceAssets` into image/video route state. No Next equivalent; same carry-state blocker as gallery detail. (HIGH.)
- Logic to preserve: `/api/media-templates` server fetch, `TemplateListItem`/`TemplateDetail` types, pagination URL builder, `generateMetadata` in `[id]`. **Keep `page.tsx` server shells; rebuild grid + card.**

## Surface: Fun Template detail `/fun-templates/[id]`

- Angular: **no dedicated detail route**. Template click opens the in-page `MediaLightbox` overlay. Use-template navigates to studio with state.
- Next: `frontend-next/app/(studio)/fun-templates/[id]/page.tsx` ✅ — server fetches `/api/media-templates/:id`, renders `Card` with `Image`, name, description, badges (industry/model/tags), prompt, and `UseTemplateButton`.
- Delta: **route mismatch** — Next invented a detail page that Angular does not have. Either remove in favor of in-place lightbox (parity) or keep as enhancement (diverges from source of truth). **Decision required from lead.** Severity **HIGH**.
- Logic to preserve if kept: `getTemplate` server fetch, `TemplateDetail` type, `UseTemplateButton` (in `features/templates/components/use-template-button.tsx` ❌ not read).

## Surface: Brand guidelines `/settings/brand-guidelines`

- Angular: `BrandGuidelineDialogComponent` (a **dialog**, not a page) at `frontend/src/app/common/components/brand-guideline-dialog/brand-guideline-dialog.component.{ts,html,scss}` ✅ (html full; ts ❌). Opened from workspace switcher menu. Backed by `BrandGuidelineService` singleton (polling 30s, max 120 attempts).
- Next: `frontend-next/app/(studio)/settings/brand-guidelines/page.tsx` ✅ renders `<BrandGuidelineUpload />` (`frontend-next/src/features/brand-guidelines/components/brand-guideline-upload.tsx` ❌ NOT READ) inside a plain `<main>` with header. `useBrandGuideline` hook ❌ not read.
- Angular dialog anatomy (verified):
  - Title "Brand Guidelines". Two modes via `@if (isEditing && data.guideline)`:
    - **View mode**: guideline name; color palette swatches (matTooltip=hex); Tone of Voice (markdown expand/collapse with "Show more/less"); Visual Style (same); Source Documents list (PDF links with `picture_as_pdf` + `open_in_new` icons). Footer: Close, Delete (warn, if `canEdit`), Replace (primary, if `canEdit`).
    - **Upload mode**: intro copy; form with Guideline Name input (required, minlength 3), "Choose PDF" stroked button + hidden file input (accept `.pdf`, max 500MB hint), validation errors; Cancel + Upload (primary, spinner state "Processing...").
- Next deltas (pending `BrandGuidelineUpload` read):
  1. **layout mismatch** — Angular exposes this via **workspace switcher dialog**, Next as a **dedicated settings page**. Different user journey. (HIGH — shared prereq: workspace switcher menu, owned by Shell agent.)
  2. **missing (presumed)** — color palette swatches, markdown tone/visual style, replace/delete actions, PDF source list. Verify against `brand-guideline-upload.tsx`. (HIGH — pending read.)
- Logic to preserve: `requireUser` server guard, `BrandGuidelineUpload` polling hook (presumed working), upload endpoint contract. **Do not rewrite polling.**

## Media primitives — structural rebuild vs restyle

| Primitive | Verdict | Reason |
|---|---|---|
| `components/media/media-card.tsx` | **STRUCTURAL REBUILD** | Wrong composition: fixed aspect, no media layering, no hover swap, no selection indicator, no carousel, no tag chips, no aspect-driven col-span. Props/type preserved. |
| `components/media/lightbox.tsx` | **STRUCTURAL REBUILD** | Missing thumbnail strip, action toolbar, share menu, custom audio, PhotoSwipe zoom. Keep a11y/keyboard shell. |
| `components/media/media-player.tsx` | **RESTYLE + audio custom UI** | Video native controls OK; audio needs custom play/slider/time to match. |
| `components/media/filters.tsx` | **UNVERIFIED — likely structural rebuild** | Must support search + date range + collapsible advanced (media type, cascading model, asset type, tags multi-select with pagination + admin entry + "only my media"). Read first. |
| `components/media/pagination.tsx` | **UNVERIFIED — likely restyle + behavior swap** | Angular = "Load more" + scroll observer, not numbered pages. Read first. |
| `components/media/infinite-loader.tsx` | **UNVERIFIED** | Read first; may already implement scroll observer. |
| `components/media/asset-picker.tsx`, `cropper.tsx`, `upload-dropzone.tsx` | **UNVERIFIED** | Not in core content scope; defer. |

## Next logic to preserve (file + symbol)

- `app/(studio)/gallery/page.tsx` — `getServerApiClient`, `listWorkspaces`, canonical `workspaceId` redirect, `GallerySearch` build, `client.post('/api/gallery/search')`. **Keep all server logic, replace JSX.**
- `app/(studio)/gallery/[id]/page.tsx` — `getMedia` with `ApiError 404 → notFound()`, `generateMetadata`. **Keep.**
- `app/(studio)/fun-templates/page.tsx` — `/api/media-templates` fetch, pagination URL builder, `TemplateListItem`/`TemplateListResponse` shape coercion (`items ?? data`). **Keep.**
- `app/(studio)/fun-templates/[id]/page.tsx` — `getTemplate`, `generateMetadata`. **Keep (route itself contested — see above).**
- `features/gallery/hooks/use-gallery-mutations.ts` — `csrfFetch`, `useGalleryMutations` (`deleteMedia`/`restoreMedia`/`copyMedia`/`tagMedia`). **Keep; surface toast/optimistic in UI.**
- `features/gallery/hooks/use-selection.ts` — `useSelection` (Set-based, toggle/selectAll/clear/isSelected). **Keep; extend with Shift-range + lastSelectedIndex.**
- `features/gallery/hooks/use-gallery.ts` — `useGallery` URL param helper. **Keep.**
- `features/gallery/mutations.ts` — `downloadZip`. **Keep.**
- `features/gallery/types.ts` — `GallerySearch`, `GalleryResponse`, `MediaDetail` type aliases. **Keep.**
- `features/gallery/components/tag-assigner.tsx` — `TagAssigner` dialog (CSV tag input, `/api/gallery/tag` POST). **Keep; compare to Angular AssignTagsDialog for UX parity.**
- `features/brand-guidelines/hooks/use-brand-guideline.ts` — polling hook ❌ not read but presumed working. **Keep; do not rewrite.**

## Shared prerequisites (blockers owned by Shell/UI agent)

1. **Content width token & sidebar-aware left margin** — Angular `--max-container-width:1400px` + `margin-left: max(calc(5vw + 4.5rem), calc(50% - 1400px/2))` assumes persistent left sidebar. Next currently uses `--tri-layout-wide` + `--tri-layout-gutter` symmetric. Gallery/templates hero + grid depend on this. → Shell agent.
2. **Hero gradient header primitive** — identical "goo" SVG filter + gradient blobs + mobile variant reused on `/` (home), `/gallery`, `/fun-templates`. Build once as shared shell hero. → Shell agent.
3. **Studio primitive library** — Angular uses `studio-button` (variants, circle shape, spinner slot, tooltip), `studio-dropdown` (multi-select, searchable, paginated, checkbox), `studio-search-filter`, `studio-date-range-filter`. Next must expose equivalents in `components/ui/**`. → Shell agent.
4. **Tooltip primitive** — Angular `matTooltip` pervasive on icon-only circle buttons. Next has no verified Tooltip in `components/ui`. → Shell agent.
5. **Dialog primitive** — Angular `MatDialog` used for bulk delete confirm, copy-to-workspace, assign-tags, tags-management, brand-guideline view/replace. Next `Dialog` exists; verify focus trap / a11y / actions alignment. → Shell agent.
6. **Snackbar/Toast primitive** — Angular `MatSnackBar` for all mutation feedback and feature hint. Next `useToast` referenced; verify persistence + position parity. → Shell agent.
7. **Router-state carry equivalent** — gallery card → detail (media item), detail → image/video/vto (remix context, source media items, preview URLs), template → studio (templateParams, sourceAssets). Angular uses `router State`; Next must encode in URL params or short server session per parity_matrix. **Decision required from lead** (not Shell) — blocks detail action wiring.
8. **Public-vs-guarded gallery** — Angular `/gallery` is unguarded while `/gallery/:id` is guarded. Next `gallery/page.tsx` redirects unauthenticated users to a sign-in message. **Decision required from lead** on canonical policy.

## What was NOT verified (must read before implementation)

- `frontend-next/src/components/media/filters.tsx`, `pagination.tsx`, `infinite-loader.tsx`, `index.ts`
- `frontend-next/src/components/media/asset-picker.tsx`, `cropper.tsx`, `upload-dropzone.tsx`
- `frontend-next/src/features/templates/components/{template-card,template-filters,template-grid,use-template-button}.tsx`
- `frontend-next/src/features/templates/types.ts`, `index.ts`
- `frontend-next/src/features/brand-guidelines/components/brand-guideline-upload.tsx`, `hooks/use-brand-guideline.ts`, `index.ts`
- `frontend/src/app/fun-templates/media-template.model.ts`
- `frontend/src/app/admin/media-templates-management/media-templates.service.ts`
- `frontend/src/app/common/components/brand-guideline-dialog/brand-guideline-dialog.component.ts` (and `.scss`)
- `frontend/src/app/common/components/media-lightbox/media-lightbox.component.html` L254-450 (share menu SVG block) and `.component.ts` L175-593 + `.scss`
- `frontend/src/app/gallery/media-detail/media-detail.component.html` L300-540 (Prompt Details / Identity / Lineage tab bodies) and `.scss`
- `frontend/src/app/common/components/studio-{button,dropdown,search-filter,date-range-filter,slider,toolbar}/*` (referenced but not read)
- `frontend/src/app/common/components/assign-tags-dialog`, `copy-to-workspace-dialog`, `confirmation-dialog`, `tags-management-dialog` referenced from gallery
- `BrandGuidelineService` Angular polling implementation
- All screenshots in repo root (`angular-gallery-1440x900.png`, `next-gallery-1440x900.png`, `angular-fun-templates-1440x900.png`, `compare-3000-gallery.png`, `compare-3000-fun-templates.png`, etc.) — not inspected (no browser per constraints)

## Confidence

- Gallery list, gallery card, media-lightbox (core), gallery service: **HIGH** — files read in full.
- Gallery detail tabs beyond Details/Technical/Debug headers, lightbox share menu internals: **MEDIUM** — outlines read, bodies inferred.
- Fun templates Next feature components, brand-guidelines Next feature components, filters/pagination/infinite-loader primitives: **LOW** — not read; deltas above are inferred from page.tsx contracts and Angular counterparts. Re-run reads before committing structural rebuild of these.
