# Templates inline loading indicator fix

Date: 2026-07-30

Replaced the plain `Loading…` paragraph in `frontend-next/src/features/admin/components/template-editor.tsx` with the shared accessible `<LoadingState label="Loading templates" />`. The Templates header and filter remain visible while `/api/admin/templates` loads; users now see the animated spinner and explicit status instead of static text. No fetch/state behavior changed.

Validation:
- Next production build passed (59/59 pages)
- ESLint passed
- Unit suite passed: 279 tests, 620 assertions
- Focused grep found no remaining generic `<p>Loading…</p>` or `Loading...` text in Admin/source-assets components
- Diagnostics contain only pre-existing Tailwind canonical-class suggestions
- Scoped Docker pre-commit and `git diff --check` run as final checks

No commits or cloud changes.