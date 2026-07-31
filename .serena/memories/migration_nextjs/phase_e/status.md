# Phase E — consolidated status (Angular→Next migration)

Written 2026-07-29 (revised post-review). Single-source rollup of every Phase E fix memory + final build/lint/test + post-review fixes. See individual `migration_nextjs/phase_e/*` memories for per-area detail.

## 1. P0 contract fixes (all landed, build green)

### Admin
- Templates create/edit contract divergence closed (create no longer 400s on missing mediaItemId).
- Tags workspace_id + CSRF: search/create/bulk-assign forward workspace_id; PATCH/DELETE verbatim; CSRF gate on mutations.
- AI GET routes: requireRole(["admin"]) added to ai-models + ai-providers (defence-in-depth).
- Source-assets admin: platform-wide browse via /search admin-filter forwarding.
- AI inline toggle + provider filter; AI subnav feature-flag gate (Angular default false).
- Media-gallery CSRF on POST mutations.

### Workflows
- WS-E types: StepType→backend snake discriminator; WorkflowStep reshaped (inputs/settings/outputs); execute args.
- WS-A BFF: run route {args}+workspace_id; batch route /batch-execute {items:[{row_index,args}]}; create/update strip definition wrapper.
- WS-C callers: use-workflows search DTO + mapping + 500ms debounce + offset pagination; run/batch hooks inject workspaceId.
- WS-B editor: per-type step-configs; user_input params→outputs; router.replace post-create.
- WS-C history: cursor pagination + state→status mapping; ExecutionDetailDialog.
- Run modal: extractInputFields reads outputs; image inputs via number field (picker ponytail).

### Content
- Asset-detail route (/asset-detail/[id]) + loading/error siblings.
- Gallery pagination preserves all search params.
- Template handoff: real generationParameters hydration.
- Copy-to-workspace dialog + copyMedia mutation.
- Gallery detail action toolbar (remix/start/end/VTO/omni/extend/concat) via sessionStorage remixState.
- Remix receivers /video + /vto read sessionStorage on mount (rAF-deferred, SSR-safe).
- Templates catalog real MediaTemplate shape + client filtering.
- Brand guidelines workspace fetch, palette, PDF links, delete/replace, owner/admin gating.
- Workbench timeline zoom/split/delete/eye/lock/thumbnail/waveform.

## 2. Parity waves completed
Admin; content journeys; generation studios handoff plumbing; workflows; workbench timeline editor.

## 3. Post-review runtime fixes (applied between build run #4 and FINAL, reviewer-applied)
- **Tools hover+click conflict** — root cause fixed in `src/components/ui/menu.tsx`. Hover preview vs click-open collided on the same trigger; resolved so hover no longer eats the click open path.
- **`/admin` Tooltip RSC runtime 500** — `cloneElement` ran in a server component when the dashboard KPI `<Tooltip>` re-cloned its single child; runtime 500 on `/admin`. Fixed by extracting the inline-SVG icon map into a dedicated **client** `KpiIconBadge` component (`app/(admin)/admin/page.tsx`), so `cloneElement` only executes client-side. Build + `/admin` runtime both green after.

## 4. Browser responsive evidence
Live responsive checks at **390x844** (iPhone-size) against Image Studio, Gallery, Templates, Workflows, Workbench, Admin.
- No document overflow on any of the six surfaces.
- Single `<main>` per page (no nested-main regression).
- All flows scroll/hit-test as expected.

## 5. Final build / lint / test counts (FINAL)
- `bunx next build`: **exit 0**. Finished TypeScript. Full route table. **0 errors / 0 warnings**.
- `bun run lint`: **exit 0**. **0 errors / 0 warnings** (after removing unused `template-card.tsx:27:13` `jsx-a11y/media-has-caption` suppression).
- `bun run test`: **exit 0**. **267 pass / 0 fail / 574 expect() calls across 40 files**.

**Phase E is BUILD / LINT / TEST GREEN.**

## 6. Remaining non-blocking items

### Cosmetic / lint smells
- N1. DashboardFilters useSearchParams without Suspense → Next 16 dynamic deopt (no warning in final build).
- N3. use-workflow-editor.ts:126 String(data.id) yields "null"/"undefined" if id missing — strict-null miss, runtime only.
- N4. csrfToken() document.cookie parse duplicated across 8 files (SSR-safe); extract to src/lib/auth/csrf-token.ts.

### Dead-route correctness gap
- N2. use-workflow-run.ts (redirected /workflows/[id]/run only) reads raw data without mapping backend state enum → poll-while-running never fires. Dead route.

### Backend-impossible / external blockers (cannot fix frontend-only)
- Source-assets edit endpoint: backend has no PUT/PATCH /api/source_assets/:id (upload/search/get/delete only). Next PATCH returns 501. Edit UI omitted. Angular also broken.
- Asset-detail preview: GET /api/media-templates/:id returns raw GCS URIs, no presigned URLs → "No preview available". Backend gap.
- Template handoff → video/audio/vto full reference-image carry: studios consume sourceAssetIds; gallery hands off media-item IDs. Image prompt prefills via URL; full ref handoff needs image-studio read-side.
- Fun-templates detail page redesign (/fun-templates/:id modal lightbox in Angular) — unreviewed deviation.
- Gallery detail Prompt Details + Lineage tabs: promptJson source unverified; deferred.
- use-workflow-run executions-list state mapping: OpenAPI /executions schema {} untyped; deferred.
- Workflow execution detail modal: current-data-only (no fresh fetch); MediaResolutionService step-type-aware resolver not ported.

### Ponytails (deliberate, documented)
- Workbench eye/lock functional in Next (Angular decorative); hidden affects preview only, not render.
- Brand guidelines plain-text summaries, no markdown dep.
- AI-models toggle errors console.error only (no snackbar).
- Run modal image inputs accept bare int sourceAssetId; ImageSelectorComponent not ported.
- Admin-charts no interactive hover tooltips/axis ticks vs Angular D3.
- Media-gallery include-deleted hardcoded true (Restore reachable); toggle deferred.