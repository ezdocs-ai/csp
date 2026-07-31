# Admin Dashboard Date-Range Parity Audit (READ-ONLY)

Scope: compare Angular `admin-home` date init/format/timezone/query lifecycle vs
Next `/admin`. No edits made. Proposes minimal parity fix + tests.

## Files inspected
Angular:
- `frontend/src/app/admin/admin-home/admin-home.component.ts` (L52-258 init + date handlers)
- `frontend/src/app/services/admin/admin-dashboard.service.ts` (query builder)
- `frontend/src/app/common/components/studio-date-range-filter/studio-date-range-filter.component.ts` (clearDates)
- `frontend/src/app/admin/admin-home/admin-home.component.html` (L23-34 `<studio-date-range-filter>`)

Next:
- `frontend-next/app/(admin)/admin/page.tsx` (server component, searchParams → query)
- `frontend-next/src/features/admin/components/dashboard-filters.tsx` (client, URL-driven)
- `frontend-next/app/api/admin/dashboard/route.ts` (forwards `?${query}` to 6 backend paths)
- `frontend-next/src/features/admin/__tests__/dashboard-filters.test.ts` (only dateRangeBounds)

## Angular behavior (source of truth)

### Default range on init (ngOnInit, L101-117)
- `now = new Date()`
- `startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)` — 1st of current month, LOCAL
- `endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)` — last day of current month, LOCAL
- Sent to `loadAllStats(startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0])`
- **Format bug in Angular itself**: init uses `toISOString().split('T')[0]` = UTC date. Manual
  changes use local `formatDate` (L190-197). Near UTC midnight these can differ by one day.
  Next should use LOCAL format consistently (matches the manual path, which is what users see).

### Cleared state (onCalendarDateChange, L222-233)
- Both null → `isCleared = true`, internal calendar set to last 6 months for display only,
  then `loadAllStats(undefined, undefined)` → service sends NO params → backend default range.

### Future-date guard (L202-220)
- If `startDate > now` or `endDate > now` → snackbar "You cannot select future dates...",
  reset to current-month default, reload. Hard block.

### Query lifecycle (service, L75-151)
- Each of 6 getters builds `?start_date=${startDate}&end_date=${endDate}` ONLY when BOTH present.
- Single missing → no params → backend default. Never sends one-sided range.
- `loadAllStats` fires all 6 in parallel (no Promise.all needed; independent subscriptions).

### Display label (currentMonthName getter, L92-99)
- Cleared or both null → `"All Time (Bounded to last 6 months Increments)"`
- Else → month name of `startCalendarDate` (e.g. "July"). Page header reads "Showing data for the current month of {{currentMonthName}}".

## Next behavior (current)

### Init (page.tsx L33-34)
- `filters = await searchParams`
- `query = new URLSearchParams(...)` from string-valued params
- Forwards to `/api/admin/dashboard?${query}` — **NO default applied**. Empty URL → empty query → backend default (last 6 months). ≠ Angular current-month default.

### Filters (dashboard-filters.tsx)
- Reads `start_date`/`end_date` from `useSearchParams`. `defaultValue` on `<input type=date>`.
- `update()` → `router.replace(`${pathname}?${params}`)` → server component refetch.
- `dateRangeBounds` cross-links max/min between the two inputs. No `max={today}` future guard.
- Sends each param independently (no both-required normalization).

## Parity gaps

| # | Gap | Angular | Next | Severity |
|---|-----|---------|------|----------|
| G1 | Initial default range | current month (1st → last day) | none (backend default) | **High** — different initial dataset |
| G2 | Future-date guard | hard block + reset | none | Med — bad data, not crash |
| G3 | Both-required query | both or none | one-sided allowed | Med — backend may mis-handle |
| G4 | Clear → all-time | isCleared flag, no params | empty URL re-triggers default (post-G1 fix) | Med — only matters after G1 |
| G5 | Init format TZ | UTC (toISOString) — Angular bug | n/a yet | Low — copy the LOCAL format, not the bug |
| G6 | Display label | "Showing data for the current month of {Month}" | static "Platform activity and health." | Low — cosmetic |

## Minimal parity fix (proposed, not applied)

Principle: smallest diff, stdlib only, no new deps, server-side default keeps SSR fetch correct.

### Fix 1 (G1, G4): server-side default with cleared marker — `page.tsx`
Add pure helper (unit-testable, no Date.now() in module scope):

```ts
// in admin-charts.tsx (already pure module) or a new small util
export function defaultMonthRange(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: iso(start), end: iso(end) };  // LOCAL, not UTC
}
```

In `page.tsx`, before building query:
- If `filters.range === "all"` → send NO start/end (matches Angular cleared path).
- Else if both `start_date`+`end_date` missing → fill from `defaultMonthRange()`.
- Pass resolved `start`/`end` as props to `<DashboardFilters defaultStart={...} defaultEnd={...} />` so inputs show current month even when URL empty.

### Fix 2 (G2): future-date guard — `dashboard-filters.tsx`
- Compute `const today = new Date().toISOString().split("T')[0];` once.
- Add `max={fromMax ?? today}` on From input and `max={today}` on To input.
- (Native `<input type=date>` clamps; no JS validation needed. Matches Angular's hard block intent without a snackbar.)

### Fix 3 (G3): both-required normalization — `dashboard-filters.tsx` `update()`
- If user sets only one of two, drop the other (or disable submit until both set).
- Simplest: in `update`, if after the set the partner is empty, delete both — match Angular service's both-or-none contract. Document as a deliberate ponytail.

### Fix 4 (G6, optional): header label — `page.tsx`
- Compute month name from resolved start; render `"Showing data for {MonthName}"` when range is a single month, else omit. Low priority.

### Not changed
- API route `route.ts` forwards as-is — fine once page normalizes.
- Query lifecycle already parallel via `Promise.all` in route — matches Angular.
- Cleanup button stays (per prior phase_e decision).

## Tests (proposed, bun:test — existing pattern)

Add to `admin-charts.test.ts` (pure, no React):
- `defaultMonthRange()` returns 1st and last day of CURRENT month, LOCAL `YYYY-MM-DD`.
- Deterministic: mock `now` → fixed `{start:"2026-07-01", end:"2026-07-31"}` for July.
- Leap-year February: `now=2024-02-15` → `end:"2024-02-29"`.
- December rollover: `now=2026-12-10` → `{start:"2026-12-01", end:"2026-12-31"}` (no month 13).
- Format zero-pads: month/day < 10 → leading zero.

Extend `dashboard-filters.test.ts`:
- (If `today` extracted to pure helper `todayISO()`) returns `YYYY-MM-DD` for current UTC date.
- `update` both-required: setting `start_date` while `end_date` empty drops both (assert via returned params builder if `update` is refactored to a pure `applyFilter(params, key, value)`).

React render tests (if RTL available — check `bun:test` + `@testing-library/react` in repo first): render `<DashboardFilters defaultStart="2026-07-01" defaultEnd="2026-07-31" />`, assert both inputs show those values; assert `max` attribute ≤ today on both.

## Confidence
90% on Angular behavior (read init + handlers + service + filter component + template).
85% on Next gap (read page + filters + route + existing test). G4 interaction only relevant
after G1 lands — verify backend `/api/admin/overview-stats` with no params truly returns
last-6-months before relying on it for the cleared path. Confirm with backend route handler
in `backend/src/admin/` before shipping G1+G4 together.
