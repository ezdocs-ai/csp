# Admin Dashboard Chart Color / Series Audit (READ-ONLY)

Scope: why Next admin donut/line (and bar) render WHITE in dark mode, exact Angular
colors, and a minimal token-based parity fix. No files edited.

## TL;DR root cause
Next generic charts `frontend-next/src/components/charts/{bar,donut,line}-chart.tsx`
hardcode `fill/stroke="var(--color-primary, currentColor)"` and donut cycles
`var(--chart-N, var(--color-primary, currentColor))`. **`--color-primary` and
`--chart-1..4` are NOT defined anywhere** in `frontend-next` (only referenced, never
declared — confirmed by grep across `src`, `app`, `tokens.css`, `globals.css`).
So every value falls through to `currentColor`. `currentColor` = inherited CSS `color`
= `--tri-text-primary` (`app/globals.css` body). In dark mode `--tri-text-primary =
#F4FBF8` (near-white) → bars/line/donut slices render WHITE. In light mode it's
`#08251E` → renders dark. **That is the white-in-dark-mode bug.**

`WorkspaceBarChart` + `MonthlyUsersChart` (`features/admin/components/admin-charts.tsx`)
use `--tri-data-viz-1/2/3` which ARE defined in `src/styles/tokens.css` → render fine.
That is why only Bar/Donut/Line go white and the two admin-charts do not.

## CSS resolution chain (verified)
- `app/globals.css` `@theme inline` maps many `--color-*` aliases but NOT `--color-primary`
  nor `--chart-*`. Body `color: var(--tri-text-primary)`.
- `src/styles/tokens.css`:
  - light `:root` → `--tri-text-primary:#08251E`; data-viz `--tri-data-viz-1:#159A62 -2:#615DF4 -3:#F45D51 -4:#E2A400 -5:#1283A8 -6:#7B4CC2 -7:#4D7A67 -8:#A4514B`
  - dark `[data-theme="dark"]` → `--tri-text-primary:#F4FBF8`; data-viz `--tri-data-viz-1:#44E493 -2:#9A96FF -3:#FF7B70 -4:#F5C451 -5:#4CC7E8 -6:#C084FC -7:#82B69E -8:#E98B83`

## Admin page → chart mapping
Page: `frontend-next/app/(admin)/admin/page.tsx`. Angular page:
`frontend/src/app/admin/admin-home/admin-home.component.{ts,html}` (D3.js, all colors hardcoded).

| Angular chart (D3) | Angular type | Next chart | Next type | Parity |
|---|---|---|---|---|
| Media Breakdown Over Time | stacked AREA, 3 series | `<BarChart data={media}>` | single-series bar (total/date) | MISMATCH — Next drops images/videos/audios split; shows only `total` |
| Active Roles Distribution | DONUT, 5-color ordinal | `<DonutChart>` (no color prop) | donut cycling `--chart-1..4` | type OK; only 4 colors vs Angular 5; colors undefined→white |
| Media Health Success | DONUT, 4 JobStatus colors | `<LineChart data={health}>` | line (date/status→count) | MISMATCH — Angular donut of job statuses; Next line |
| Media per Workspace | stacked BAR, 3 series | `<WorkspaceBarChart>` | stacked div segments | OK (uses `--tri-data-viz-1/2/3`, defined) |
| Monthly Active Users | line + gradient area | `<MonthlyUsersChart>` | line + gradient area | viz OK; color differs (Angular #6366f1 vs token viz-1 mint) |

## Exact Angular D3 colors (admin-home.component.ts)
Container tokens (Tailwind literal): panel `bg-[#1E1F22]`; stat cards `bg-[#2A2B2F]`;
chart cards `bg-zinc-900/50 border-zinc-800`; headings `text-zinc-200`/`text-zinc-400`;
page text `text-gray-100`.

Per chart (all hardcoded hex, opacity 0.8 on fills):
- Media over time (stacked area) L337-340: Images `#3b82f6`, Videos `#ef4444`, Audios `#a855f7`.
- Media per Workspace (stacked bar) L489-492: Images `#3b82f6`, Videos `#f87171`, Audios `#8b5cf6`.
- Active Roles (donut) L619-622 ordinal: `#3b82f6`, `#f87171`, `#8b5cf6`, `#fbbf24`, `#4ade80`; slice stroke `#1E1F22` width 2.
- Media Health (donut) L717-722 by JobStatus: COMPLETED `#4ade80`, FAILED `#ef4444`, PROCESSING `#fbbf24`, STOPPED `#9ca3af`; slice stroke `#1E1F22` width 2.
- Monthly Active Users (line+area) L849-856,836-840: stroke/circles `#6366f1`; gradient `#6366f1` 0.4→0; hoverline `#a1a1aa`.
- Axis tick text: `#9ca3af`. Legend text: `#e5e7eb`.

Note: Angular is dark-only (hardcoded dark hex). The Angular palette (#3b82f6 etc.)
does NOT match the Next `--tri-data-viz-*` token palette (#159A62 mint etc.), so exact
visual parity needs explicit per-series colors, not just a token alias.

## Why donut/line (and bar) render white in dark mode (precise)
1. Generic chart fill/stroke = `var(--color-primary, currentColor)`.
2. `--color-primary` undefined → CSS falls back to `currentColor`.
3. `currentColor` = inherited `color` = `--tri-text-primary`.
4. Dark theme `--tri-text-primary = #F4FBF8` (near-white) → shapes white.
Donut: page passes `{label, value}` with NO `color` prop → `color ?? var(--chart-N, var(--color-primary, currentColor))`; `--chart-N` also undefined → same white fallthrough.

## Minimal token-based parity fix (proposed, NOT applied)
Two-layer; do layer 1 (stops the white bug), layer 2 (exact Angular colors).

### Layer 1 — stop white fallthrough (smallest diff, no component edits)
Add aliases in `app/globals.css` inside the existing `@theme inline { }` block:
```css
--color-primary: var(--tri-data-viz-1);
--chart-1: var(--tri-data-viz-1);
--chart-2: var(--tri-data-viz-2);
--chart-3: var(--tri-data-viz-3);
--chart-4: var(--tri-data-viz-4);
```
Now Bar/Line use viz-1 mint, Donut cycles the 4-token palette. Fix is 5 lines, tokens
already theme-aware (light+dark) → no more white in dark mode.

### Layer 2 — exact Angular per-series parity (optional, color mismatch)
`--tri-data-viz-*` is a green-forward palette, not Angular's blue/red/purple. For exact
parity pass explicit `color`/series colors from `app/(admin)/admin/page.tsx`:
- Donut: pass `color` per role → map roles to Angular 5-color ordinal
  `['#3b82f6','#f87171','#8b5cf6','#fbbf24','#4ade80']` (but only 4 cycle in component;
  bump to 5 or pass explicit colors).
- BarChart: generic component is single-series; to match Angular 3-series stacked area
  it must gain series support (bigger change) — or accept single total-series colored
  `#3b82f6`.
- LineChart health: Angular is a donut by JobStatus, not a line; true parity = swap to
  donut with COMPLETED `#4ade80` / FAILED `#ef4444` / PROCESSING `#fbbf24` / STOPPED `#9ca3af`.
- MonthlyUsersChart: switch from `--tri-data-viz-1` to `#6366f1` (Angular indigo) if
  exact parity wanted.

ponytail ceiling: Layer 1 = correct token fix (white bug gone). Layer 2 only if pixel
parity with Angular required; defer until Angular→Next palette decision is made.

## Files referenced (no edits)
- `frontend-next/src/components/charts/bar-chart.tsx` (undefined token)
- `frontend-next/src/components/charts/donut-chart.tsx` (undefined tokens)
- `frontend-next/src/components/charts/line-chart.tsx` (undefined token)
- `frontend-next/app/(admin)/admin/page.tsx` (mapping; passes no `color` to Donut)
- `frontend-next/src/features/admin/components/admin-charts.tsx` (uses defined tokens)
- `frontend-next/app/globals.css` (`@theme inline`; missing aliases)
- `frontend-next/src/styles/tokens.css` (data-viz + text-primary defs)
- `frontend/src/app/admin/admin-home/admin-home.component.ts` (Angular D3 source of truth)
