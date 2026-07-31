# Gallery filters + detail parity implementation log

Owner: Filters/detail agent. Write set: `components/media/filters.tsx`, `features/gallery/components/gallery-detail.tsx`, `app/(studio)/gallery/**` page files, `features/gallery/gallery-utils.ts` (+tests, additive). Source of truth: `mem:migration_nextjs/parity_routes/content`. Predecessor log: `mem:migration_nextjs/parity_impl/gallery` (Task 1 + pure helpers done).

## Props contract — NO CHANGE to `Filters`
- `<Filters />` consumed exactly once: `features/gallery/components/gallery-view.tsx` L150, no props. Rebuilt component keeps the **zero-props** signature. `gallery-view.tsx` (owned by another agent) NOT touched. No caller breaks. `GalleryDetail({ media })` prop signature also unchanged.

## Task 4 — `filters.tsx` structural rebuild (DONE)
- File: `frontend-next/src/components/media/filters.tsx` (rewritten). Now a literal `"use client";` client component.
- Anatomy matches Angular `media-gallery.component.html` L86-180:
  - **Permanent row** (flex-wrap, items-end): Search `<Input type="search">` (`md:w-96`, placeholder "Search prompt, model or email..."), From / To native `<input type="date">`, "Filters" toggle `<Button variant="secondary" aria-expanded aria-controls>`.
  - **Collapsible advanced row** (`useState` toggle, `id="gallery-advanced-filters"`): Media Type native `<select>` (All Types / Image / Video / Audio → `type` param), Tags comma-separated `<Input>` (→ `tags` param).
- State encoded entirely in URL search params; reuses the existing `update()` → `URLSearchParams` → `router.replace` pattern, still resets `page` on every change.
- **`@`-detection added** (content delta 8, LOW → closed): search term containing `@` writes `owner` and clears `query`; else writes `query` and clears `owner`. Matches Angular `searchTerm()`.
- Native elements only (`<select>`, `<input type="date"|"search">`, `<Button>`). No new deps. Styled with existing `--tri-input-*` / `--tri-space-*` / `--tri-radius-*` / `--tri-border-*` / `--tri-bg-*` vars (mirrors `components/ui/input.tsx`). `Field` reused for labels.
- A11y: labels via `Field`, ≥44px hit targets, `aria-expanded`+`aria-controls` on toggle.
- Diagnostics: clean (only pre-existing Tailwind "can be written as" noise — same bracket-var style `Input.tsx` already uses).

### Gaps DEFERRED from Task 4
1. **Generation Model dropdown** — no `MODEL_CONFIGS` equivalent in Next; hardcoding would couple/stale.
2. **Asset Type dropdown** — `gallery/page.tsx` doesn't read `itemType`; adding needs a server-logic change the hard rules forbid.
3. **"My tags" / "Select only my media" checkboxes** — need session email; `Filters` has no props and `gallery-view.tsx` (would thread it) is another agent's.
4. **Searchable paginated tags multi-select + admin gear + tags-mgmt dialog** — reduced to comma-separated input.
5. **Status field** — REMOVED from UI to match Angular (Angular exposes no status control). Server still reads `status` URL param. Default-status gap (delta 9) is a server decision, not touched.

## Task 6 — Gallery detail tabs + page wiring (DONE)

### `features/gallery/components/gallery-detail.tsx` (rewritten; now `"use client"`)
- Ports Angular `media-detail.component.html`: full-width header row with right-aligned `← Go to Gallery` `<Link href="/gallery">` (delta 1), then `lg:grid-cols-3` — left `lg:col-span-2` media stage, right `<aside>` (status `<Badge>` + title + tab bar + tab panels).
- **Tab hierarchy** (delta 1, 3) via `role="tablist"`/`role="tab"` `aria-selected` buttons (`useState<TabKey>`): **Details** (always), **Technical** (always), **Debug** (conditional on `rawData`/`audioAnalysis`/`errorMessage`).
- **Details tab** (delta 3): Parameters (creator avatar `<img>` + email; Model, Created At `toLocaleString`, Generation Time `s`, Voice, Language, Seed, NumMedia, Duration=`durationSeconds`, Aspect Ratio, Resolution, Google Search) via shared `MetaGrid`; Tags chips; Grounding (webSearchQueries chips + groundingChunks source links — `searchEntryPoint` HTML SKIPPED/XSS); Prompt expand/collapse (20-word truncate, `line-clamp-3`); Referenced Assets thumbnails (sourceMediaItems → `/gallery/:id?img_index=N`; sourceAssets plain thumbnails — no Next `/asset-detail` route); Style grid (style/lighting/colorAndTone/composition — `modifiers` not in Next schema).
- **Technical tab** (delta 3): File Info (Mime Type, Watermark=`addWatermark`), Storage (`gcsUris` linked — schema: public display URLs), Other (comment, critique).
- **Debug tab** (delta 3): errorMessage (danger box), rawData `<pre>`, audioAnalysis `<pre>`.
- **Hard-rule fix:** main stage + avatar + referenced-asset thumbnails switched from `next/image` to `<img>` with `// eslint-disable-next-line @next/next/no-img-element` on its own line above each. No `next/image` imports remain.
- Local helpers `SubHeading` + `MetaGrid` (no exported API change). Removed dead disabled placeholder action buttons (delta 4 blocked).
- Diagnostics: clean (pre-existing Tailwind noise; `--tri-text-link`/`--tri-text-danger`/`--tri-bg-danger-subtle` used with hex fallbacks).

### `app/(studio)/gallery/[id]/page.tsx` (minimal edit)
- Added `requireUser` import + `await requireUser();` as first line of `GalleryDetailPage` (hard rule). Server fetch (`getServerApiClient`, `getMedia` → `client.get('/api/gallery/item/:id')`, `ApiError` 404→`notFound()`, `generateMetadata`) preserved VERBATIM. JSX unchanged.

### `app/(studio)/gallery/page.tsx` (minimal edit)
- Added `requireUser` import + `await requireUser();` as first line of `GalleryPage` (hard rule). **No behavior change**: `(studio)/layout.tsx` L41 already calls `requireUser()` (all studio routes were already auth-gated). Pre-existing inline `if (!client)` "Sign in" branch retained verbatim (now unreachable, kept for minimal diff). Server fetch/redirect/request-build preserved verbatim.

### `app/(studio)/gallery/[id]/loading.tsx` + `error.tsx` (NEW — delta 6, MEDIUM)
- `loading.tsx`: server default export, 3-col skeleton (`lg:col-span-2` aspect-video pulse + aside pulse stack), mirrors `gallery/loading.tsx`.
- `error.tsx`: `"use client"`, `Error({ reset })` → `EmptyState` "Media unavailable" + Retry `<Button onClick={reset}>`, mirrors `gallery/error.tsx`.

### Gaps DEFERRED from Task 6 (loud)
1. **Lightbox action toolbar wiring** (delta 2) — `lightbox.tsx` owned by Task-3 agent; did NOT mount `<Lightbox>` to avoid coupling to its in-flux props.
2. **Edit/Video/VTO/Omni/Extend/Concatenate/Delete/Tags navigation** (delta 4) — blocked on lead decision re: router-State carry (content memo L129). Removed misleading disabled placeholders.
3. **Source-asset lightbox overlay** (delta 5) — blocked on Task-3 lightbox.
4. **Prompt Details + Lineage tabs** — Angular `promptJson` source + bodies (html L300-540) UNVERIFIED in gap analysis.
5. **Admin "Create Template"** — target `/templates/edit/:id` is an orphan route.
6. **`searchEntryPoint` rendered HTML** — XSS; needs sanitizer (none installed).
7. **Referenced source-asset links** — plain thumbnails (no `/asset-detail` route in Next).
8. **Status default `COMPLETED`** (delta 9) — server-page decision, not touched.

## Verification notes (UNVERIFIED at runtime)
- No terminal/browser. Validated via `read_file` re-reads after every edit + `diagnostics` on all 6 touched files (clean except pre-existing Tailwind style noise). `diagnostics` does NOT catch `"use client"` placement or bad path aliases — confirmed manually: literal `"use client";` at top of `filters.tsx`, `gallery-detail.tsx`, both `error.tsx`; server pages have NO directive; all imports use `@/src/...` (never `@/lib/...`). Type usage verified against OpenAPI types (`MediaItemResponse`/`SourceAssetLinkResponse`/`SourceMediaItemLinkResponse`/`TagModel`).
- NOT run: `bun test`, `docker compose`, pre-commit, browser screenshot diff. `gallery-utils.ts` + its tests were NOT modified (no additive change needed for Tasks 4/6).
