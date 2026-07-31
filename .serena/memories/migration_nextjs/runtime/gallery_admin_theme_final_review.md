# Final read-only review — Gallery race / Admin date-range / Dark danger (2026-07-30)

Verdict: **NO BLOCKERS.** Ship-ready. All explicit requirements met. Non-blocker notes below.

## Verified PASS

### Gallery — server-redirect / WorkspaceSwitcher race
- `app/(studio)/gallery/page.tsx`: canonical `redirect()` REMOVED. When `?workspaceId` absent, renders first workspace directly (`listWorkspaces(client)[0]`), validates `Number.isInteger && >=1` else throws. No server redirect → no collision with client `router.replace`.
- `WorkspaceSwitcher` (`src/features/workspaces/components/workspace-switcher.tsx`) owns URL sync: `useEffect` sets `?workspaceId` only when differs from `activeWorkspace.id` (guard at L99) → no infinite loop. Gallery is server component reading searchParams; switcher nav re-renders gallery with param. Clean.
- **Workspace ID stays valid**: `numberValue()` (int>0) + fallback re-validation before use. `GallerySearch.workspaceId` always positive int. `requireUser()` guards unauth (early-return sign-in panel).
- NOTE: parity memory `parity_routes/content.md` still says "Keep redirect" — doc drift (intentional deviation to fix race). Update that note when convenient.

### Admin date-range
- `defaultDashboardDateRange()` = first..last day of current LOCAL month + `today` (local). Matches "current local month". Leap/year-boundary covered by test.
- Both dates sent together: `admin/page.tsx` L48 sets start_date+end_date together or neither. `DashboardFilters.apply()` sets both or deletes both. Never one alone.
- All-time distinguishable: `range=all` → start="" end="" → query omits dates (backend = all-time). Distinct from default-month (sends both dates, no `range`). Clearing (`apply("")`) sets `range=all`.
- Future blocked at UI: `Input max={today}` on both; `fromMax` capped `min(end,today)`; `toMin=start`. User cannot pick future.
- `key={`${start}:${end}`}` remounts filters on URL change → input state resyncs. Good.

### Dark danger contrast
- Dark: `--tri-button-danger-fg` → `var(--tri-brand-on-primary)` = `#02231C` on bg `--tri-state-error`=`#FF7B70`. Contrast ~6.6:1 (was ~2.5:1 with white). AA pass, big improvement.
- Light: untouched (`#FFFFFF` on `#C83D35`). No regression.

### Tests / diagnostics
- New tests: `__tests__/dashboard-date-range.test.ts` + `dashboard-filters.test.ts` (bun:test). Cover pure helper + `dateRangeBounds`.
- Diagnostics: no errors. Only Tailwind arbitrary-value style warnings (cosmetic).

## Non-blocker observations (judgment calls, not required to ship)

1. **`--color-muted-foreground` undefined** — `admin/page.tsx` L71 + L80 use `text-[var(--color-muted-foreground)]`. globals `@theme inline` defines only `--color-foreground{-secondary,-tertiary}`, NOT `muted-foreground`. Var invalid → text inherits primary color (readable, but not muted as intended). Likely pre-existing. Fix → `--color-foreground-secondary` / `-tertiary`.
2. **Default "To" > today mid-month** — default end = last day of current month; on non-month-end days end>today while input `max={today}` → "To" field renders value beyond its own max (overflow/invalid state on load). Consistent with "full current month" default + "future blocked for picks", but UI shows out-of-range value. Consider clamping displayed default end to `min(monthEnd, today)` OR raising its max for the default.
3. **No server-side date clamp** — `admin/page.tsx` trusts `start_date`/`end_date` from URL (no `<=today` check). Hand-crafted future-date URL passes through to `/api/admin/dashboard`. UI max only. Defense-in-depth gap (matches likely-Angular behavior, not a functional break).
4. **Critical orchestration untested** — `admin/page.tsx` allTime/both-together resolution + `DashboardFilters.apply()` have no direct test; only pure helpers tested. Server-component+fetch + router-coupled apply are hard to unit-test, hence lower coverage on the requirement-critical paths.
5. **Gallery fallback scope mismatch** — gallery fallback uses first workspace (any scope); switcher `resolveActiveWorkspace` defaults to first PUBLIC workspace. If first workspace is private + a public exists → one-time client nav + content swap (no redirect race, just a flash). Pre-existing scope-resolution nuance.

## Files touched
- `frontend-next/app/(studio)/gallery/page.tsx`
- `frontend-next/app/(admin)/admin/page.tsx`
- `frontend-next/src/features/admin/components/dashboard-filters.tsx`
- `frontend-next/src/features/admin/components/dashboard-date-range.ts`
- `frontend-next/src/features/admin/__tests__/dashboard-date-range.test.ts`
- `frontend-next/src/features/admin/__tests__/dashboard-filters.test.ts`
- `frontend-next/src/styles/tokens.css` (dark `--tri-button-danger-fg` L168)
