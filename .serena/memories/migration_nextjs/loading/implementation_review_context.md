# Loading rollout implementation review context

Date: 2026-07-30

Scope changed in `frontend-next`:
- Added `app/loading.tsx`, `app/(studio)/loading.tsx`, `app/(admin)/admin/loading.tsx`, `app/(public)/loading.tsx`, all using shared `LoadingState`.
- Refactored `gallery/loading.tsx`, `gallery/[id]/loading.tsx`, and `asset-detail/[id]/loading.tsx` to wrap tailored skeletons in `LoadingState`.
- Corrected loader-only undefined `--tri-layout-grid-gap` uses to `--tri-grid-gap`.
- Deleted redundant `fun-templates/loading.tsx`; studio group fallback now covers it and removes undefined `--tri-bg-subtle` loader tokens.
- Replaced bare loading paragraphs in `ai-models-admin.tsx` and `ai-providers-admin.tsx` with labeled `LoadingState`.
- No changes to runtime data, nav, infra, or cloud resources.

Review for Next.js loading-boundary correctness, accessibility, layout/style regressions, and scope. Do not edit files.