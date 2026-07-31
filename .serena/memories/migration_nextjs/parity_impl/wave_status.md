# UI/UX parity recovery — implementation wave status

Lead-coordinated. Angular `frontend/` = source of truth. See `mem:migration_nextjs/ui_ux_parity_recovery` + `mem:migration_nextjs/ui_ux_parallel_agents`.
Phase A discovery memories: `parity_routes/{browser_evidence,shell,generation,content,complex_admin}`.
Phase B/C impl logs: `parity_impl/{shell,generation_primitives,gallery,admin_workflows}`.
Wave 2 impl logs: `parity_impl/{gallery_media_primitives,gallery_filters_detail,workbench,admin_media_tags,admin_templates_dashboard}`.

## Lead-owned changes (done)
- **Blockers**: CSRF cookie unified on `csp_csrf` (`app/api/admin/users/**`, `use-admin-users.ts`, `user-edit-dialog.tsx`); `/workflows` role gate in `src/middleware.ts` (admin||workflows); `app/api/auth/login/route.ts` now sources roles from backend `GET /api/users/me` with env allowlist as fallback only.
- **Gating primitives** (built before spawning, 3 lanes depended on them): `ui/menu.tsx` (Menu/MenuItem/MenuDivider, `hover`+`closeGraceMs` reproduces Angular Tools flyout), `ui/confirm-dialog.tsx`, `ui/tooltip.tsx` (+position/delay/multiline), `ui/dialog.tsx` (+description/panelClassName/maxWidth), `ui/toast{,-provider}.tsx` (per-toast placement top-right|bottom-center, filled success/danger tones, z-99999).
- **Workspace model (G2)**: `lib/workspace/api.ts` `Workspace = {id,name,scope,ownerId}` via a `toWorkspace` mapper. NOTE: backend does **not** return a members array (verified in `frontend-next/openapi.json` → `WorkspaceModel`) — the shell memo was wrong. Compute `canInvite` from scope + role/ownership.
- `lib/workspace/context.tsx`: default workspace now prefers first PUBLIC (Angular behavior).
- **Cross-lane fix**: `MediaCardProps` gained `anySelected` + 2-arg `onSelect(media, event)` so gallery Shift-range selection works.
- Deleted dead `features/gallery/components/gallery-grid.tsx` (+ barrel export).

## Lane outcomes
1. **Shell** (`parity_impl/shell`) — DONE. Closed G1,G3,G4,G5,G6,G7,G8,G9,G10,G13,G14,G15. Topbar removed from studio shell; switcher is a floating glass pill + Menu; admin reuses studio shell. Deferred G16 (atmosphere), G17 (route transitions). `WorkspaceSwitcher` now takes `{userId, isAdmin}`.
2. **Generation primitives** (`parity_impl/generation_primitives`) — DONE, additive only. New in `components/studio/`: `flow-prompt-box`, `generation-overlay`, `option-toolbar`, `studio-hero`, `media-lightbox` (incl. `comparison` variant + `clipInset`), `reference-media-strip` + one bun test. **No studio page adopts them yet.**
3. **Gallery** (`parity_impl/gallery`) — Task 1 only (hero + date-masonry + Shift/Cmd/Esc selection + hint snackbar + bulk bar, `gallery-utils.ts` + tests). Tasks 2–6 NOT done: media-card rebuild, lightbox, filters, media-player audio UI, detail tabs.
4. **Admin/Workflows** (`parity_impl/admin_workflows`) — Tasks 1–2 done (`/admin/users` multi-role+filters+paginator+sortable; `/workflows` New button, run modal, route convergence, `/run` redirects, JSON dump gone). Task 3 partial (`assets-panel.tsx` created but NOT integrated). Tasks 4–7 not started.

## Verification state
- `diagnostics` project-wide: **0 errors in `frontend-next`**. Only pre-existing Tailwind "can be written as" warnings + an unrelated `docker-compose.override.yml` error.
- **NOT RUN** (no shell tool in these sessions): `bun run lint`, `bun run build`, `bun test`, `docker compose run --rm pre-commit run --all-files`. Run these first next session.
- **No browser verification.** Next session cookie expired during Phase A; only Angular↔Next *Video* is a valid paired capture. Everything else is code-level only.

## Wave 2 (DONE — 5 parallel agents, all lane-3/lane-4 leftovers closed)
Lead fixes first: both `@next/next/no-img-element` warnings (extracted `Avatar` in `users-table.tsx`, `AssetThumbnail` in `assets-panel.tsx` — `edit_file` could not match those long single-line JSX blocks, `write_file` was required); `app/(studio)/vto/page.tsx` now `await requireUser()`.
- `gallery_media_primitives` — media-card rebuilt (aspect spacer, hover-to-play, carousel, tag chips, selection indicator); `media/lightbox.tsx` now a thin a11y modal shell delegating to `studio/media-lightbox.tsx`; custom `AudioPlayer` in `media-player.tsx`. Removed the non-Angular card title/badge/date footer.
- `gallery_filters_detail` — `filters.tsx` rebuilt (props contract unchanged, zero-props); `gallery-detail.tsx` tabbed (Details/Technical/Debug); gallery pages got `requireUser()`; added `[id]/loading.tsx`+`error.tsx`.
- `workbench` — `AssetsPanel` integrated into `workbench.tsx`, tool rail (gallery/audio/stories/edit), new `properties-panel.tsx`, BETA tooltip. Timeline/trim/time + tests untouched.
- `admin_media_tags` — full Angular filter set + columns + paginator on `/admin/media-gallery` (+ pure `buildMediaQuery` & bun test); `tag-manager.tsx` inline edit + `ColorPicker`, `prompt()` gone.
- `admin_templates_dashboard` — templates create/edit `Dialog` + thumbnail + sort/paginate; new dep-free `admin-charts.tsx` (CSS bars + SVG polyline, `role="img"` + sr-only table, pure `stackedHeights`/`linePoints` + bun test); `requireRole(["admin"])` on the dashboard page. Admin pages live under `app/(admin)/admin/**`, NOT `(studio)`.

### Two backend/route blockers surfaced (out of every agent's write set)
- `/admin/media-gallery` GET route forwards to `/api/media-items`, which does **not** exist in `backend/main.py` (only `/api/gallery`). Page 404s regardless of filters — repoint at `/api/gallery/search`; snake_case `GallerySearchDto` params are already being sent.
- `app/api/admin/dashboard/route.ts` does not forward `workspace-stats` / `monthly-active-users`, so both new charts render empty. Page reads the fields defensively → populates with zero page changes once the route is fixed.

### Decisions
- No `superAdmin` role exists in `src/lib/auth/session.ts` (`admin|user|creator|workflows`); dashboard gates on `admin` — do NOT invent one.
- Charts are hand-rolled SVG/CSS by the no-new-deps rule.

## Next steps
1. Run `cd frontend-next && bun run build && bun run lint && bun run test`, then `docker compose run --rm pre-commit run --all-files`. **`bun run test`, not bare `bun test`** (bare walks the repo and loads Playwright specs in Bun's runner → recurring harmless "6 fail / 6 errors").
2. Fix the two route blockers above (media-gallery → `/api/gallery/search`; dashboard → forward stats endpoints).
3. Ask user to re-login the Next tab (Google SSO) + confirm local user has `admin`+`workflows`; then paired-screenshot verification.
4. Workflow **editor** internals still gapped (HIGH): Outputs panel, User Input Parameters, drag-reorder, step execution details at `/workflows/new` + `/[id]/edit`.
5. Wave 3: adopt the generation primitives in the 5 studio pages (Video/Upscale/VTO Critical, Image/Audio High). One agent per feature dir, disjoint. Drive `FlowPromptBox` from `use-video-capabilities.ts` — the Next registry is *more correct* than Angular's hardcoded lists.
6. Phase D: 3 read-only reviewers (visual, interaction/a11y, code/runtime), then fix only verified regressions.

## Pitfalls
- **Never reload the Angular tab** (`localhost:4200`) — auth is not reload-safe; navigate by clicking UI only.
- Spawned agents burn context fast. Give tight scopes and tell them to write their Serena memory *incrementally*. Recovery: re-prompt the same `session_id` with "stop now, write memory, reply 12 lines."
- **Agents must use the `write_memory` tool, not `write_file` into `.serena/memories/`** — that path is virtualized, `write_file` reports success but the log never registers. All 5 wave-2 agents made this mistake; fixed by re-prompting each `session_id`. Say so explicitly in the spawn prompt.
- `edit_file` cannot reliably match very long single-line JSX even when `grep` proves the text is verbatim, and it silently truncates long `new_text` (one edit landed as `}, [load]);page, filter]);`). Use `write_file` for those, and always re-read the touched region.
- `diagnostics` (LSP) reported 0 errors while `bun run build` had 9. It misses `"use client"` boundary violations, unresolved `@/*` aliases, missing barrel exports, **and strict-null errors like "This expression is never nullish"** (a redundant `?? ""` after a ternary in `media-gallery-admin.tsx` was invisible to the LSP but failed `next build`'s type check). **Always gate on `bun run build`.** Note `next build` stops at the FIRST type error, so one green-looking run does not mean the rest is clean — re-run until it passes.
- **There are NO Angular↔Next parity tests.** `bun run test` is pure-function unit tests only (query builders, date grouping, timeline math, session signing, chart geometry). Parity is verified by code reading + paired browser screenshots, never by an automated cross-app assertion. Do not claim parity from a green test run.
- `middleware.ts` lives at `src/middleware.ts`, not repo root. Auth API routes live in `app/api/`, not `src/app/api/`.
- `grep` with `include_pattern` sometimes misses existing paths; prefer unscoped grep or `find_path` with `**/`.
- Known gaps outside any lane's write set: `/terms-of-service` route missing (footer links to it → 404); `ui/topbar.tsx` still imported by `app/visual/page.tsx` + `ui/_smoke.tsx`; `/fun-templates/[id]` is an invented route Angular lacks (undecided); Brand Guidelines is a dialog in Angular but a page in Next (undecided).
