# Admin dashboard chart, navigation, and data fixes

Date: 2026-07-30

## Chart colors
Generic Bar/Donut/Line charts referenced undefined `--color-primary` and `--chart-*`, falling back to currentColor (near-white in dark mode). Added actual theme-boundary palette variables matching Angular roles: blue, red, purple, yellow, green. Donut now cycles five colors. Browser computed tokens verified all six values are non-white.

## Navigation overlap
The fixed WorkspaceSwitcher overlapped the first AdminSubnav item on desktop. Admin subnav now shifts right only at md/xl breakpoints (`md:ml-[7.5rem] xl:ml-[7rem]`); studio shell and mobile bottom switcher remain unchanged.

## Zero KPI/media values
FastAPI BaseDto serializes snake_case model fields as camelCase. Angular already consumes camelCase, but Next looked up snake_case KPI keys and `total` instead of `totalGenerated`, producing zeros.

Fix:
- DashboardData types use actual camelCase wire keys.
- KPI descriptors retain stable snake_case UI/icon `key` and add camelCase `sourceKey` for values.
- `overviewKpis` reads `sourceKey`.
- media-over-time reads `totalGenerated` first.
- tests assert camelCase mapping while preserving icon keys.

## Validation
- production build: pass
- lint: pass
- full unit suite: 281 pass, 0 fail, 618 assertions, 45 files
- targeted dashboard/theme tests: 10 pass
- scoped pre-commit: pass
- diff check: pass
- independent final review: no blockers (`mem:migration_nextjs/runtime/admin_dashboard_final_review`)

No cloud changes or commits performed.
