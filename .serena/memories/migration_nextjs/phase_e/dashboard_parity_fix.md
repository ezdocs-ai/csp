# Phase E — Admin Dashboard Parity Fix (Next.js)

Scope: Next.js admin dashboard parity with Angular `admin-home`. Owned files only:
- `frontend-next/app/(admin)/admin/page.tsx`
- `frontend-next/src/features/admin/components/admin-charts.tsx`
- `frontend-next/src/features/admin/components/dashboard-filters.tsx`
- focused tests under `frontend-next/src/features/admin/__tests__/`

## Evidence sources
- Angular KPIs: `frontend/src/app/admin/admin-home/admin-home.component.html` (8 cards) + `admin-dashboard.service.ts` `AdminOverviewStats`.
- Backend keys (snake_case): `backend/src/admin/dto/admin_response_dto.py` `AdminOverviewStats` → `total_users, total_workspaces, images_generated, videos_generated, audios_generated, total_media, user_uploaded_media, overall_total_media`.
- Next API: `frontend-next/app/api/admin/dashboard/route.ts` GET forwards `overview` (snake_case) + `mediaOverTime/activeRoles/generationHealth/mediaPerWorkspace/monthlyActiveUsers`; POST proxies `/api/admin/cleanup-stuck-jobs`.

## The eight KPIs (stable order, key→label→accent→tooltip)
total_users→Total Users→blue | total_workspaces→Workspaces→purple | images_generated→Images Gen.→red | videos_generated→Videos Gen.→green | audios_generated→Audios Gen.→yellow | total_media→AI Media Total→teal | user_uploaded_media→Uploaded→indigo | overall_total_media→Overall Total→orange. Tooltips match Angular matTooltip text verbatim.

## Decisions (per task constraints)
1. NO superAdmin gate: Angular gates on superAdmin tier w/ "Restricted View" fallback, but Next `Role` union (src/lib/auth/session.ts) has no superAdmin. Page keeps `requireRole(["admin"])` only. Comment in page.tsx documents why.
2. Cleanup action NOT moved: Angular dashboard has NO cleanup button — `cleanupStuckJobs()` lives in `media-gallery-management.component.html` ("Clear Stuck Jobs"). Next dashboard's `<form action="/api/admin/dashboard" method="post">` proxies cleanup-stuck-jobs correctly where it is. Media-gallery page is not an owned file, so move impossible + task forbids unless required. Kept in place untouched.
3. No new deps: icons are inline SVG (no icon lib); date-range uses native `<input type=date>` + `Input` primitive. Charts preserved (BarChart/DonutChart/LineChart + WorkspaceBarChart/MonthlyUsersChart) — all already responsive (w-full + viewBox).
4. Primitives reused: `Card`, `Tooltip`, `Input`. (Field primitive lacks className prop → manual labeled wrapper for width control.)

## Changes
- admin-charts.tsx: added `OVERVIEW_KPIS` descriptor + `overviewKpis(overview)` pure resolver (stable order, missing→0, tolerates undefined). Replaces unstable `Object.entries(...).replaceAll("_"," ")`.
- page.tsx: imports Card/Tooltip/overviewKpis; 8 inline SVG icon fns + `KPI_ICONS` map; KPI grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8`, Card `min-w-0` (no overflow), Tooltip on icon span, number `tabular-nums`. Charts + cleanup form unchanged.
- dashboard-filters.tsx: `<fieldset>/<legend sr-only>` grouping, `useId()` label/htmlFor, cross-linked `max` on From / `min` on To via pure `dateRangeBounds(start,end)`, `Input` primitive, `min-w-[8rem]` wrappers + `flex-wrap` (mobile no overflow). Query params `start_date`/`end_date` + `router.replace` behavior preserved.

## Tests (bun:test) — all pass
- admin-charts.test.ts: + OVERVIEW_KPIS order/8, overviewKpis mapping+default 0, undefined tolerance.
- dashboard-filters.test.ts (new): dateRangeBounds empty/cross-link cases.
- Full suite: 192 pass / 0 fail. tsc errors all pre-existing & in non-owned files (bun:test module resolution, copy-to-workspace-dialog, workflow-editor, session.test, design-system.spec). Editor diagnostics on owned files: clean (only Tailwind v4 shorthand warnings, consistent w/ Field/Input/Card primitives — intentionally not "fixed").

## Follow-ups (out of scope)
- DashboardFilters uses useSearchParams w/o Suspense boundary (pre-existing Next deopt); wrap in <Suspense> if build warns.
- Cleanup button still uses raw styled <button>, not `Button` primitive, label "Clean stuck jobs" (Angular media-gallery says "Clear Stuck Jobs"). Left per "do not move cleanup" constraint; revisit if cleanup migrates to media-gallery page.
- admin-charts `ponytail`: no interactive hover tooltips/axis ticks vs Angular D3.
