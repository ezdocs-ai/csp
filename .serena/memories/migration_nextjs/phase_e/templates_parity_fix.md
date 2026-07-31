# Phase E — Fun templates catalog parity + studio handoff hydration

Date: 2026-07-29. Scope: `csp/frontend-next/src/features/templates/**`, `csp/frontend-next/app/(studio)/fun-templates/**`, plus video/audio studio route pages + entry props (image route untouched — already handled). Backend NOT modified (verification only).

## Backend MediaTemplate response — VERIFIED
- `GET /api/media-templates` → `PaginationResponseDto[MediaTemplateResponse]`. Fields (camelCase wire): `id, name, description, mimeType, industry, brand, tags[], gcsUris[], thumbnailUris[], generationParameters{prompt,model,aspectRatio,style,lighting,colorAndTone,composition,negativePrompt}, sourceAssets[{assetId,role}], presignedUrls[], presignedThumbnailUrls[], enrichedSourceAssets[{assetId,role,presignedUrl,gcsUri,presignedThumbnailUrl?,mimeType?}]`. Pagination: `{data, count, page, pageSize, totalPages}` (NOT `items`/`total`).
- `GET /api/media-templates/{id}` → `MediaTemplateModel` — **RAW, NO presigned URLs, NO enriched source assets** (only gcsUris/thumbnailUris/sourceAssets). ⇒ detail page has no browser-displayable preview. Known backend gap; not invented around.

## What was broken before
`types.ts` used INVENTED fields: `thumbnailUrl` (singular), top-level `mediaType`/`sourceMediaId`/`prompt`/`model`/`options`. None exist on the backend. Filters only had q/industry/model (no mediaType/tags/name). Card showed only a single thumbnail. Use Template forwarded flat `template.model`/`template.prompt`.

## Changes
### types.ts (rewritten — real fields only)
- `TemplateGenerationParameters`, `TemplateSourceAsset`, `EnrichedSourceAsset`, `MediaTemplate` (= MediaTemplateModel), `MediaTemplateResponse` (= +presigned/enriched), `TemplateListResponse` (= PaginationResponseDto), `TemplateFilter` (Angular parity: industry/mediaType/tags/model/name), `EMPTY_TEMPLATE_FILTER`, `TEMPLATE_MEDIA_TYPES = ["image/png","video/mp4","audio/mpeg"]`.
- Removed `TemplateListItem`, `TemplateDetail` (invented).

### mappers.ts (new, pure, tested)
- `filterTemplates(templates, filter)` — 1:1 port of Angular `FunTemplatesComponent.applyFilters` (industry/mediaType exact; name/model/tags case-insensitive includes). Backend `TemplateSearchDto` only supports industry/brand/mime_type/tag server-side, so name+model MUST be client-side.
- `uniqueIndustries(templates)` — Angular `[...new Set(...)].sort()`.
- `previewUrlFor(template)` — `presignedThumbnailUrls[0] ?? presignedUrls[0]`.

### components (Angular-faithful catalog, client-side filtering)
- `template-catalog.tsx` (new) — client; holds `TemplateFilter` state, `filterTemplates` via useMemo, renders filters+grid+empty state. Replaces server-filtered page.
- `template-filters.tsx` (rewrite) — name/tags/model text inputs + industry/mediaType selects (from uniqueIndustries / TEMPLATE_MEDIA_TYPES) + Clear button. Local state (Angular parity).
- `template-card.tsx` (rewrite) — media preview: video mime → `<video poster=thumb src=presignedUrls[0]>`; audio → ♪ glyph; image → `<img src=previewUrlFor>`. Badges: industry/brand/model(gen)/tags. Source-asset thumbnail strip from `enrichedSourceAssets` (presignedThumbnailUrl||presignedUrl). Use Template button. Card body links to `/fun-templates/{id}`.
- `template-grid.tsx` — typed to `MediaTemplateResponse[]`.
- `use-template-button.tsx` (rewrite) — `buildTemplateParams` reads ONLY `generationParameters` (no flat fields); `sourceAssetIds` from enrichedSourceAssets ?? sourceAssets. `studioRouteFor(mimeType)`: video→/video, audio→/audio, else→/. `deriveMediaType(mimeType)`. (Audio routes to /audio — Angular lumps audio into "/", but audio studio state supports prompt/negativePrompt so we hydrate it; see hydration note.)

### route pages
- `fun-templates/page.tsx` — fetches `?limit=30` (Angular `MediaTemplatesService` parity), renders `<TemplateCatalog templates={response.data ?? []}>`. Dropped server-side query filtering + pagination (Angular filters client-side, shows all 30).
- `fun-templates/[id]/page.tsx` — typed to `MediaTemplate`; renders generationParameters prompt + industry/brand/model/tags badges. Preview = "No preview available" (detail endpoint has no presigned URLs — honest). No invented fields.

### Studio handoff hydration (typed initial state)
- Video (`video/page.tsx` + `video-studio.tsx`): page reads URL params → `Partial<VideoGenerationRequest>` {prompt, generationModel(model), aspectRatio, style, colorAndTone, lighting, composition, negativePrompt, referenceAssetIds(←sourceAssetIds)}. `VideoStudio` gained `initialState?` prop forwarded to existing `useVideoState(initial)` (which already merged initial over localStorage). NOTE: video-studio's capability effect may override generationModel with registry default IF template model isn't registered — acceptable (falls back gracefully).
- Audio (`audio/page.tsx` + `audio-studio.tsx`): page reads prompt+negativePrompt → `AudioStudio initialState?` prop used as useState seeds. ONLY prompt+negativePrompt wired (model is AudioModel union "lyria"|"chirp"|"gemini-tts" — does NOT map to a template vendor model string, so intentionally not wired).
- VTO: NOT wired. No `vto` mime/mediaType exists on backend (MimeTypeEnum = image/png|video/mp4|audio/mpeg), so VTO is unreachable from the catalog by mime; role-based routing would be speculative. Per "ONLY as necessary" + lazy principle, skipped. `studioRouteFor` keeps a `/vto` branch for type completeness but it's never mime-reachable.

## Tests (pure mappers only)
- `__tests__/mappers.test.ts` (new, 10): filterTemplates empty/industry/mediaType/name/model/tags/AND-combine/no-match; uniqueIndustries sorted+null-omit; previewUrlFor thumb-preferred.
- `__tests__/use-template-button.test.ts` (updated, 7): deriveMediaType, studioRouteByMime, buildTemplateParams gen-based (removed flat-fallback test), sourceAssetIds enriched-preferred/plain/NaN-drop/omit-empty.

## Verification
- `bun test src/features/templates src/features/video-studio src/features/audio-studio src/features/vto-studio` → **34 pass / 0 fail** (27 new/updated template + studio tests; studios unchanged logic still green).
- `bunx tsc --noEmit` scoped to changed files → 0 errors (only pre-existing project-wide `bun:test` module-resolution warning, which does not affect `bun test` runtime — same as prior phases).
- Diagnostics: only Tailwind `var(--…)` shorthand style suggestions (project-wide convention, intentionally left as-is, matches workbench phase).
- addlicense: all 14 changed frontend-next files carry `Copyright 2026 Google LLC — Apache-2.0` header. pre-commit gts/black/pylint are scoped to `frontend/`+`backend/` and do NOT cover `frontend-next/`, so no further lint applies.

## Intentionally NOT done
- No backend change (detail-endpoint presigned-URL gap remains; out of scope — task was frontend parity + verification).
- No VTO studio changes (not mime-reachable; no invented routing).
- No image carousel auto-slide (Angular auto-slides every 3s); card shows first preview only (lazy; previews plural = media + source-asset strip).
- No lightbox on card (Angular opens media-lightbox; Next detail route covers drill-down).
