# AI registry loading and table UI improvement

Date: 2026-07-30
Status: COMPLETE

## Root cause validated
Authenticated browser navigation to `/admin/ai-models` showed both `/api/admin/ai-providers` and `/api/admin/ai-models` client refetches after server-rendered model rows were already present. Hooks started with empty arrays/loading=true while components fell back to `initial`, so a page-sized LoadingState was stacked above usable rows.

## Changes
- `use-ai-models.ts` and `use-ai-providers.ts` accept optional server initial arrays, seed state from them, and only begin in loading state when initial data is empty.
- AI Models and AI Providers no longer render large `LoadingState` blocks above populated tables.
- Compact `Spinner size="sm"` refresh status appears beside Add actions; stable rows remain visible with `aria-busy` on tables.
- Empty initial loads use a compact spinner inside the table; true empty results use `EmptyState`.
- Fixed filtered-model correctness by using hook state directly instead of falling back to full initial rows when a filtered response is empty.
- Both raw tables migrated to shared `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableCell`, `Badge`, `Button`, and `EmptyState` primitives.
- Added semantic column scopes/table labels, responsive horizontal overflow, monospace long IDs, environment/type/secret badges, row hover styling, consistent actions, and row counts.
- Edit actions now use shared modal `Dialog`; Delete actions require destructive `ConfirmDialog` confirmation.
- Fixed shared `Dialog` duplicate `id="dialog-title"` bug using `useId()` so multiple mounted dialogs have correct accessible names.

## Live browser verification
- `/admin/ai-models`: 16 rows rendered without oversized loading gap; provider filter 44px tokenized control; canonical table header/rows/badges/actions; no console warnings.
- `/admin/ai-providers`: 2 rows rendered in canonical table; no oversized loading gap; no console warnings.
- Provider Edit opens modal announced as `Edit provider`; Escape closes it.
- Provider Delete opens `Delete AI provider` confirmation with dependency warning; Cancel closes without mutation.

## Validation
- Next production build: pass (59/59 pages)
- ESLint: pass
- Unit tests: 279 pass, 0 fail, 620 assertions
- Diagnostics: no errors (only Tailwind canonical-class suggestions in existing style)
- Independent final review: pass, no blockers
- Scoped Docker pre-commit and `git diff --check`: final checks pass

No API contracts, cloud resources, infrastructure, dependencies, or commits changed.