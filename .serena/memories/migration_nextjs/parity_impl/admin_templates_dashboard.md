# Parity impl log: Admin templates + dashboard

Owner: Admin/Workflows agent. Written 2026-07-28. Angular = source of truth. `csp/frontend-next/**` is the port target. Tasks 6 (admin templates create/edit dialog + thumbnail) and 7 (dashboard 2 charts + superAdmin gate).

## Task 6 — `/admin/templates` create/edit dialog + thumbnail ✅ DONE
Changed files:
- `src/features/admin/components/template-editor.tsx` — REBUILT (was inline form + plain table). Now: `Create Template` button opens a `Dialog` (size lg, maxWidth 60rem) form; `Edit` action per row opens the same dialog prefilled. Table columns: thumbnail, name, description (truncate + title tooltip), mimeType chip (`Badge`, tone info for video/mp4, neutral for image/png), industry, brand, actions (iconOnly edit/delete buttons, ≥44px, aria-label each). Added: debounced filter input (500ms via `useDebouncedCallback`), client-side sort via `SortableHead` (name/description/mimeType/industry/brand, 3-state asc/desc/none), `Paginator` ([10,25,100]), `EmptyState`, `ConfirmDialog` for delete (replaces raw DELETE button). New `Thumbnail` helper renders signed remote URLs as `<img>` with `// eslint-disable-next-line @next/next/no-img-element` on its own line (precedent: `users-table.tsx` Avatar), fallback initial. Fixed `JSON.parse(options)` footgun — wrapped in try/catch, surfaces "Options must be valid JSON." error.
- API calls PRESERVED VERBATIM: GET `/api/admin/templates` (load), POST `/api/admin/templates` (create) / PATCH `/api/admin/templates/:id` (edit) with `{...form, options, tags[]}` body, DELETE `/api/admin/templates/:id`. Flat field shape (name/description/mimeType/model/industry/brand/tags/options/thumbnail_url/gcs_uri) kept identical — NOT Angular's nested `generationParameters`/`gcsUris[]` shape, to avoid breaking the existing PATCH contract.
- `app/(admin)/admin/templates/page.tsx` — UNCHANGED (already calls `requireRole(["admin"])`, renders `TemplateEditor`).

Gaps closed: create/edit dialog flow, thumbnail column, mimeType chip, description/brand columns, debounced filter, paginator, sort headers, delete confirmation, JSON.parse safety, loading/error/empty states.
DEFERRED / delta: (a) Angular's create flow posts the FULL nested template body; Next's POST route only accepts `mediaItemId` (`/api/media-templates/from-media-item/:id`) and 400s otherwise — the Next "Create" dialog posts the flat body to `/api/admin/templates` which will 400 until the API route is changed. The API route (`app/api/admin/templates/route.ts`) is OUT OF SCOPE (not an admin page file); left untouched, recorded here for lead. (b) Form uses flat fields, not Angular's nested generationParameters/gcsUris arrays. (c) No chips-input for tags (comma-separated instead). (d) mimeType select is a fixed 2-option list (image/png, video/mp4), not Angular's full `MimeTypeEnum`.
UNVERIFIED: template-editor fetch calls send NO `x-csrf-token` header — this matches the ORIGINAL template-editor verbatim (preserve rule); other admin components send CSRF via their hooks. Whether these routes enforce CSRF is unverified. Did NOT add or remove CSRF handling.

## Task 7 — `/admin` dashboard: 2 charts + superAdmin gate ✅ DONE
Changed files:
- `src/features/admin/components/admin-charts.tsx` (NEW) — two plain SVG/CSS chart components, NO charting dependency:
  - `WorkspaceBarChart` ("Media per workspace"): CSS flex of columns; each column height = % of max total, inner segments sized via `flexGrow` weights (images/videos/audios, colors `--tri-data-viz-1/2/3`). `role="img"` + descriptive `aria-label` summary; sibling visually-hidden `<table>` data fallback; color legend.
  - `MonthlyUsersChart` ("Monthly active users"): single `<svg>` with `<polyline>` + gradient `<polygon>` area fill + per-point `<circle><title>`. `role="img"` + `aria-label` summary; sibling sr-only `<table>` fallback.
  - Pure helpers exported: `stackedHeights(bar, max)` → `{total, columnPercent}`, `linePoints(data, width, height)` → `"x,y x,y"`.
- `src/features/admin/__tests__/admin-charts.test.ts` (NEW) — `bun:test` (NOT node:test) covering `stackedHeights` (total, columnPercent, zero-max guard) and `linePoints` (single-point left-margin clamp, two-point spread, zero-max guard).
- `app/(admin)/admin/page.tsx` — added auth guard `await requireRole(["admin"])` (matches `app/(studio)/workflows/page.tsx` pattern); preserves existing fetch to `/api/admin/dashboard`, the 4 KPI/overview cards, `DashboardFilters`, and the original 3 charts (`BarChart` "Media over time", `DonutChart` "Role distribution", `LineChart` "Generation health"). Added 2 new chart cards ("Media per workspace", "Monthly active users") mapping `mediaPerWorkspace`/`monthlyActiveUsers` DEFENSIVELY from the response (multiple field-name aliases). "Clean stuck jobs" form left untouched.

### Chart-approximation delta
Angular charts are full D3 impls in `admin-home.component.ts` (stacked bars with hover tooltips/legend/axis ticks; line+area with gradient + crosshair hover). Next approximations are static: NO interactive hover tooltips, NO axis tick labels, NO crosshair. Colors via `--tri-data-viz-1/2/3`. Stacked bar uses flex `flexGrow` segment weights instead of pixel-precise D3 bands. Recorded rather than adding a dependency (hard rule: no new deps).

### superAdmin-role decision
Angular gates the full dashboard on `isSuperAdmin$` with a "Restricted View" fallback for org admins. **The Next session `Role` union is `"admin" | "user" | "creator" | "workflows"` (`src/lib/auth/session.ts`) — there is NO `superAdmin` role, and the backend role population point was NOT verified.** Per task guidance, did NOT invent a superAdmin role. Gated on `admin` (the layout already calls `requireRole(["admin"])`; added an explicit page-level guard too). Every Next admin is therefore equivalent to Angular's superAdmin intent, so the "Restricted View" fallback has NO audience in Next and was intentionally NOT implemented. If a superAdmin role is later added to the session, wrap the chart section in a role check and add the Restricted View fallback.

### DEFERRED for lead (out of my scope — API route, not a page file)
The dashboard's two new charts will render EMPTY until `/api/admin/dashboard/route.ts` is extended to also forward the backend `workspace-stats` and `monthly-active-users` aggregations (it currently only returns overview/mediaOverTime/activeRoles/generationHealth). The page reads these fields defensively, so they populate with ZERO page changes once the route forwards them. Both charts already render a graceful empty state.

## Additive exports (admin-controls.tsx / index.ts)
- `admin-controls.tsx` — UNCHANGED (no new control needed; all required primitives already existed).
- `index.ts` — ADDITIVE only:
  - `export { MonthlyUsersChart, WorkspaceBarChart, linePoints, stackedHeights } from "./components/admin-charts";`
  - `export type { MonthlyUsersPoint, WorkspaceBar } from "./components/admin-charts";`
  - No existing export renamed/re-signed/removed. Verified by eye each imported name exists in `admin-charts.tsx`.

## Verification
- No terminal/shell available → could not run `bun test` or `next build`/pre-commit.
- `diagnostics` run on every touched file: 0 errors. Only Tailwind v4 shorthand style warnings (e.g. `bg-[var(--tri-data-viz-1)]` → `bg-(--tri-data-viz-1)`) — these match the established codebase convention (`admin-controls.tsx`, `users-table.tsx` all use the `var(--tri-*)` arbitrary-value form), so left as-is to stay consistent.
- `diagnostics` does NOT catch: "use client" directive issues, bad `@/*` path aliases, missing barrel exports. Verified all three BY EYE: `"use client";` is a literal directive at top of `template-editor.tsx` (not `import "use client"`); dashboard `page.tsx` is a server component (no directive) and calls `await requireRole(...)`; all imports resolve to real exports (`@/src/features/admin` → barrel → `admin-charts.tsx`; `@/src/lib/auth/server` → `requireRole`; `@/src/components/ui` → barrel).
- `linePoints` test expectations hand-derived from the formula `y = (height-28) - (v/max)*(height-48)` (height=240 → top point y=20).

## Note on this memory
Initial attempt wrote the log as a raw file via `write_file` to `csp/.serena/memories/...`; that write reported success but the file did NOT persist (confirmed via `find_path`/`read_file`/`list_directory`). Re-saved via the `write_memory` tool as required for Serena memory registration.