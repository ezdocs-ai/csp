# Parity impl log: Admin media-gallery + tags agent

Owner: Admin media-gallery/tags agent. Written 2026-07-28. Angular = source of truth. Write set: `media-gallery-admin.tsx`, `tag-manager.tsx`, and their hooks only.

## ⚠️ BLOCKER FOR LEAD (route, out of scope) — /api/media-items does not exist
The Next GET route `app/api/admin/media-gallery/route.ts` forwards to backend **`/api/media-items`**, which **does not exist**. Backend has only `/api/gallery` (routers confirmed in `backend/main.py`: `gallery_router`, no media-items router). Angular admin POSTs to `/api/gallery/search`. So `/admin/media-gallery` currently **404s server-side regardless of filters**.
The component now sends Angular-aligned snake_case `GallerySearchDto` params (`search`,`user_email`,`status`,`item_type`,`model`,`tags`,`start_date`,`end_date`,`limit`,`offset`), so once the route is repointed at `/api/gallery/search` the filters will work. Route NOT touched (out of this agent's write set).

## Task 4 — `/admin/media-gallery` filters DONE
Files: `src/features/admin/components/media-gallery-admin.tsx` (rebuilt); `src/features/admin/__tests__/media-query.test.ts` (NEW, bun:test for `buildMediaQuery`).
Filters ported (order/labels match Angular media-gallery-management): Search (debounced 400ms), User Email (debounced), Status (select: All/Completed/Processing/Failed/Stopped), Type (select: All / AI Generated=media_item / User Upload=source_asset), Model (select, 15 models mirroring Angular MODEL_CONFIGS), Tags (MultiSelect, options from GET /api/admin/tags), Date Range (2x native `<input type=date>` + Clear dates).
Columns ported: Preview (audio glyph / `<img>` thumbnail / fallback), Workspace, User (avatar `<img>` or initial, email tooltip), Type/Model (AI Generated info badge / User Upload neutral badge + model badge), Status (badge w/ tone via `statusTone`), Created, Actions (open-in-new `<a target=_blank>` to `/gallery/:id` or `/asset-detail/:id`; Delete via ConfirmDialog; Restore immediate).
Other: Paginator [5,10,25,50] default 10; SortableHead on Workspace/User/Status/Created (client-side sort, aria-sort); Clear Stuck Jobs button w/ `title` tooltip ("Clear jobs in processing for more than 1 hour") + ConfirmDialog; deleted rows opacity-50.
Preserved verbatim: GET endpoint `/api/admin/media-gallery`, POST action dispatch (cleanup/delete/restore). PRESERVED the lead's fixed pattern exactly: `useCallback(load, [filters, page, pageSize])` + `useEffect(() => { void load(); }, [load])`, kept as a `.then` chain so no synchronous setState-in-effect. Filter state lives in the useCallback dep array as instructed. Reused from `./admin-controls`: MultiSelect, Paginator, SortableHead, useDebouncedCallback, pageOffset, toQuery, SortDirection. Remote image URLs use `<img>` with `// eslint-disable-next-line @next/next/no-img-element` on its own line (matches users-table.tsx). No next/image.
Added exported pure helpers: `buildMediaQuery`, `statusTone`, types `MediaGalleryItem`/`MediaFilters`, option tables `MEDIA_STATUS_OPTIONS`/`MEDIA_TYPE_OPTIONS`/`MODEL_OPTIONS`.

Gaps deferred:
- Include-deleted checkbox NOT added: GET route hardcodes `params.set("include_deleted","true")` so a toggle would be a silent no-op (misleading UI). Re-enable only after editing that route.
- Loading spinner NOT added: dropped to avoid synchronous setState-in-effect lint error (the `.then`-chain load pattern can't set a loading flag synchronously). Empty state covers no-data.
- Thumbnail/audio/workspace-name/user-avatar/model-chip rendering is defensive (camel+snake fallbacks) because the data shape is unverified until the route blocker is fixed.

## Task 5 — `/admin/tags` color picker + inline edit DONE
File: `src/features/admin/components/tag-manager.tsx`. Added `color?` to Tag. Columns now ID / Name / Color / Actions (Angular column set).
Inline edit (replaces prompt()): per-row editingId/editName/editColor state. startEdit seeds editColor = tag.color || '#E8EAED' (Angular default). Name cell -> Input (aria-label), color cell -> ColorPicker while editing; Save (disabled when name empty) + Cancel buttons. Save PATCHes `/api/admin/tags/:id` body `{name, color}` (endpoint/method preserved; only added color to the body).
Color column (read mode): swatch `<span style=backgroundColor>` + hex text.
Paginator added: [5,10,20] default 10 (Angular pageSizeOptions). load -> `useCallback(load, [page, pageSize])` + `useEffect([load])` as a `.then` chain; POSTs `action:search` with `{limit, offset}` and reads `count`.
Preserved verbatim: create form + bulk-assign form (same fetch calls/inputs); only wrapped inputs in Field+Input for labels/hit-targets (accessibility) and folded bulk-assign into a native `<details>` disclosure. Delete preserved as direct DELETE (matches Angular — no confirm there). Reused ColorPicker + Paginator + pageOffset from `./admin-controls` (no new control, no new deps).
CSRF: tag-manager mutations carry NO `x-csrf-token` header (unchanged from original; backend tags endpoints evidently don't require it since create/delete already worked). Cookie name stays canonical `csp_csrf`; never `csrf-token`.

Gaps deferred (NOT in task 5 scope = color + inline edit):
- Create-form workspace_id manual input kept (Angular resolves workspace implicitly); changing it risks the backend contract.
- Bulk-assign form kept (Angular hides it on this page) — removing working logic is out of scope.
- Tag delete has no confirm (matches Angular + original).

## Summary
Tasks 4 + 5 complete. Files changed: media-gallery-admin.tsx, tag-manager.tsx, __tests__/media-query.test.ts (new). No hooks needed changes (reused admin-controls exports + pageOffset). No new deps. No edits to admin-controls.tsx, users-table.tsx, user-edit-dialog.tsx, template-editor.tsx, dashboard-filters.tsx, index.ts, or any route.
Lead open items: (1) media-gallery route 404 — repoint /api/media-items -> /api/gallery/search; (2) include-deleted checkbox + loading spinner deferred (see Task 4).
Unverified: no shell for bun test/lint; verified by inspection + diagnostics. Both component files: only Tailwind v4 bracket-`var()` shorthand WARNINGS (consistent with existing admin-controls.tsx/users-table.tsx); zero errors.
Controls worth promoting to admin-controls.tsx later: `statusTone` (status->badge tone); the MODEL/STATUS/TYPE option tables could be shared if other admin tables need them.
