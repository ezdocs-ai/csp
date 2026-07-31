# Gallery Filters Parity (R2) — Closed

## Goal
Close residual parity gap R2: Next.js gallery filter panel now matches Angular
`media-gallery.component` filter anatomy. Added Generation Model, Asset Type,
searchable Tags multi-select, My tags / Only my media toggles, and admin Manage
Tags entry.

## Files Owned & Changed
- `src/components/media/filters.tsx` — full rewrite. New props: `userEmail`,
  `userId?`, `isAdmin?`, `tags`. Deep import of pure helpers from
  `@/src/features/gallery/gallery-filters` (NOT the barrel — avoids circular
  dep: media barrel → filters → gallery barrel → gallery-view → media barrel).
- `src/features/gallery/gallery-filters.ts` — NEW pure helpers (no DOM/React):
  `MODEL_OPTIONS` (15 models, value/label/type matching Angular MODEL_CONFIGS),
  `MEDIA_TYPE_OPTIONS`, `ASSET_TYPE_OPTIONS`, `filterModelOptions(mediaType)`,
  `isModelValidForType(model, mediaType)`, `parseTagsParam`,
  `serializeTagsParam`, `toggleTag`.
- `src/features/gallery/__tests__/gallery-filters.test.ts` — NEW, 15 pure tests.
- `src/features/gallery/components/gallery-view.tsx` — `GalleryViewProps` gained
  `userEmail`, `userId?`, `isAdmin?`, `tags?`. Passes through to `<Filters>`.
- `src/features/gallery/index.ts` — re-exports `gallery-filters`.
- `app/(studio)/gallery/page.tsx` — captures `session` from `requireUser()`;
  parses `model`, `itemType`, `mine`; resolves numeric `userId` via
  `GET /api/users/me` and workspace tags via `POST /api/tags/search`
  (both `Promise.allSettled` best-effort); passes context to `<GalleryView>`.

## URL Param Contract (source of truth)
| Param     | Backend field  | Source |
|-----------|----------------|--------|
| `query`   | `query`        | search box (no @) |
| `owner`   | `userEmail`    | search box (has @) |
| `mine=1`  | `userEmail`    | "Only my media" → overrides owner with session.email |
| `type`    | `mimeType`     | Media Type select |
| `model`   | `model`        | Generation Model select (enum) |
| `itemType`| `itemType`     | Asset Type select (media_item / source_asset) |
| `tags`    | `tags[]`       | CSV from multi-select chips |
| `startDate`/`endDate` | dates | date inputs |

## Backend Semantics Confirmed (GallerySearchDto)
`model?: GenerationModelEnum`, `itemType?: string`, `tags?: string[]`,
`userEmail?: string` — all present and consumed by `UnifiedGalleryRepository`.
`/api/users/me` returns `UserModel.id` (numeric) → enables "My tags".
`/api/tags/search` accepts `{workspaceId, limit, offset, userId}` (USER+ADMIN).

## Key Behaviors
- **Media Type → Model reset**: `onMediaTypeChange` clears `model` if invalid
  for new type (Angular `onMediaTypeChange` parity). Model select uses React
  `key` to remount on URL change so uncontrolled `defaultValue` stays in sync.
- **Model filtering**: `filterModelOptions("image/*")` → IMAGE only; `video/*`
  → VIDEO; `audio/*` → AUDIO; "" → all (incl TEXT). TEXT models only under All.
- **My tags**: defaults `true` when `userId` resolved (Angular parity). Filters
  tag catalogue client-side by `tag.userId === userId`. Disabled if no userId.
- **Only my media**: `mine=1` URL param; page sets `userEmail = session.email`,
  overriding `owner`. Defaults `false` (Angular parity).
- **Manage Tags**: ghost button → `router.push("/admin/tags")`, shown only when
  `isAdmin` (session.roles includes "admin").
- **Tags multi-select**: search input filters option list; selected tags are
  removable chips; checkbox list with `min-h-[var(--tri-input-height)]` rows.

## Accessibility / Mobile
- All controls 44px: selects `h-[var(--tri-input-height)]`; checkboxes inside
  `min-h-[var(--tri-input-height)]` labels; Button `min-h-[var(--tri-button-height)]`.
- Rows use `flex flex-wrap`; advanced panel `grid sm:grid-cols-2 xl:grid-cols-3`;
  tags span `sm:col-span-2 xl:col-span-3`; list `max-h-44 overflow-y-auto`.

## Validation
- `bun test src/features/gallery/__tests__/` → 45 pass (15 new + 30 existing).
- `bunx tsc --noEmit` → no errors in changed files (pre-existing unrelated
  error in `gallery-detail.tsx:80` — `string | null` vs `string | undefined`).
- `bunx next build` → compiled successfully; type-check blocks only on the
  pre-existing `gallery-detail.tsx` error.
- `bunx eslint` on all changed files → clean (exit 0).
- Diagnostics: only Tailwind v4 shorthand warnings (codebase-wide style, not errors).

## NOT Done / Out of Scope
- Did not fix pre-existing `gallery-detail.tsx` type error (unrelated).
- Did not add paginated "Load more" for tags (single fetch limit 100; Angular
  paginates at 10/page with load-more). Follow-up if workspace has 100+ tags.
- Did not implement tags-management DIALOG (Angular opens a dialog); Next.js
  links to the existing `/admin/tags` admin page instead — functional equivalent.
- No new dependencies added.
