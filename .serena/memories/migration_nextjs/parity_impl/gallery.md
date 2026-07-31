# Gallery/Content parity implementation log

Owner: Gallery/Content implementation agent. Write set: `features/gallery/**`, `components/media/**`, `app/(studio)/gallery/**`. Append-only log; one section per task in severity order. Read `mem:migration_nextjs/parity_routes/content` for the verified gap analysis.

## Pure helpers (prereq — DONE)
- Added `frontend-next/src/features/gallery/gallery-utils.ts` exporting: `groupMediaByDate`, `parseAspectRatio`, `isWideMedia`, `isTallMedia`, `selectionRange` (shift-range math), `getShortPrompt`, `compositeKey`. All pure, no DOM imports. Direct ports of Angular `MediaGalleryComponent.updateGroups/isWide/isTall`, `MediaGalleryComponent.toggleSelection` shift branch, `GalleryCardComponent.getShortPrompt`.
- Added `frontend-next/src/features/gallery/__tests__/gallery-utils.test.ts` (`bun:test`, matches `lib/workspace/__tests__/active.test.ts` style). Covers Today/Yesterday/weekly/weekly-crossing-month/monthly buckets, group ordering, createdAt-less drop, aspect parse invalid cases, isWide/isTall thresholds, selectionRange null anchor + direction-agnostic + index-0 anchor, getShortPrompt JSON/fallback/truncation.
- Exported via `features/gallery/index.ts` barrel.
- Diagnostics: clean.

## Task 1 — Gallery list page (DONE)
- `app/(studio)/gallery/page.tsx`: preserved verbatim — server fetch (`getServerApiClient`, `client.post('/api/gallery/search')`), workspace redirect, `GallerySearch` request build, `pageSize=24`, all helper fns (`stringValue`/`numberValue`/`statusValue`/`csvValue`). Only the return JSX swapped: now `<GalleryView currentPage={...} media={response.data ?? []} totalPages={...} />`. Removed `<Filters/>` + `<GalleryGrid/>` + `<Pagination/>` imports (they now live inside `GalleryView`).
- Added `features/gallery/components/gallery-view.tsx` (client): `GalleryHero` (gradient-blob header — gallery-local approximation of Angular's goo-filter hero; Shell agent owns the shared primitive), date-grouped masonry (`groupMediaByDate` → `<h2>{title}</h2>` + `grid-cols-2 md:grid-cols-4 grid-flow-dense` with `col-span-2` on `isWideMedia`), selection model (Set<string> of composite keys, single-click toggle, Shift+click range via `selectionRange`, Cmd/Ctrl additive, Esc clears via window keydown listener), one-time hint snackbar via `useToast(...).show(msg, "info", "bottom-center")` gated by `localStorage[gallery_features_hint_seen]`, `<Filters/>` + Select all/Deselect all button, `<Pagination/>`, and `<BulkActions/>` mounted when selection non-empty.
- `use-selection.ts` kept verbatim — Shift-range logic lives in `gallery-view.tsx` because the existing hook only has single-toggle and the task forbids rewriting it. Selection state is local `useState<Set<string>>` using `compositeKey(item) = \`${itemType}:${id}\`` to match Angular.
- `features/gallery/index.ts` barrel updated: added `gallery-utils` and `gallery-view` exports.
- Diagnostics: clean (only pre-existing Tailwind "can be written as" noise).

## Tasks NOT done (stopped by user after task 1)
- Task 2: `media-card.tsx` structural rebuild (hover overlay, tag chips, selection affordance, aspect-driven spacer, hover-to-play video swap, carousel, item-type overlay icon). **Card body unchanged.** Note: `gallery-view.tsx` already passes `anySelected` prop and a 2-arg `onSelect(item, event)` to `MediaCard`; current card type only declares `(media) => void` and no `anySelected`. The diagnostics tool reported zero errors on `gallery-view.tsx`, but `tsc --strict` at build time may flag this — task 2 owner MUST update `MediaCardProps` to `{ onSelect?: (media, event: MouseEvent) => void; anySelected?: boolean; ... }` and change the card button's `onClick={() => onSelect(media)}` to `onClick={(event) => onSelect(media, event)}` so Shift+click detection works. Existing callers (VTO, workflow-run) pass no `onSelect` so they remain compatible.
- Task 3: `lightbox.tsx` structural rebuild.
- Task 4: `filters.tsx` structural rebuild (current `<Filters/>` still the bare `<details>` select row).
- Task 5: `media-player.tsx` custom audio UI.
- Task 6: Gallery detail page tabs + action wiring.

## Known leftovers / housekeeping
- `features/gallery/components/gallery-grid.tsx` is now orphaned (page no longer renders it). Left in place + still re-exported from barrel to avoid touching external consumers; no longer reachable from gallery route. Candidate for deletion once task 2 confirms no other internal consumer needs it.
- Gaps deferred from task 1: (a) "Load more" / IntersectionObserver accumulation — Angular accumulates client-side, Next is per-URL-page server fetch; kept numbered `<Pagination/>` to preserve server pagination contract per memory note. (b) Sidebar-aware asymmetric `margin-left` + 1400px max — shared prerequisite owned by Shell agent. (c) Search-bar "@user" → userEmail rewrite — low severity, not addressed.
- No files outside write set touched. No shared-primitive API gaps hit during task 1 (consumed `Button`, `EmptyState`, `useToast`, `Filters`, `MediaCard`, `Pagination`, `BulkActions` as-is).
