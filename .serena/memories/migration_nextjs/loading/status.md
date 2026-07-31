# Loading rollout status

Date: 2026-07-30
Status: COMPLETE

## Implemented
- Added shared route fallbacks using `LoadingState`:
  - `frontend-next/app/loading.tsx`
  - `frontend-next/app/(studio)/loading.tsx`
  - `frontend-next/app/(admin)/admin/loading.tsx`
  - `frontend-next/app/(public)/loading.tsx`
- Refactored tailored skeleton fallbacks to include the accessible spinner/message while retaining route-specific shapes:
  - `app/(studio)/gallery/loading.tsx`
  - `app/(studio)/gallery/[id]/loading.tsx`
  - `app/(studio)/asset-detail/[id]/loading.tsx`
- Corrected loader-only undefined `--tri-layout-grid-gap` references to `--tri-grid-gap`.
- Deleted redundant `app/(studio)/fun-templates/loading.tsx`; the studio fallback now covers both list/detail and removes broken `--tri-bg-subtle` loader styling.
- Replaced bare loading paragraphs in AI Models and AI Providers admin components with labeled `LoadingState`.
- Hardened `LoadingState` with `w-full grid-cols-1` so shaped skeleton children retain full content width.

## Feature gating
AI Providers and AI Models remain always present in AdminSubnav. No `aiProviderRegistryAdmin`, `NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN`, `useFeatureFlag`, or feature-flags references remain.

## Validation
- `bun run --cwd frontend-next build`: pass (Next.js 16.2.11, 59/59 static pages)
- `bun run --cwd frontend-next lint`: pass
- `bun run --cwd frontend-next test`: pass (279 tests, 620 assertions)
- `bun run --cwd frontend-next test:e2e tests/e2e/smoke.spec.ts`: 4 pass, 3 authenticated checks skipped because no storage state was supplied
- Scoped `docker compose run --rm pre-commit run --files ...`: pass (`addlicense`; frontend-next not covered by legacy gts-fix hook, but direct ESLint passed)
- `git diff --check`: pass; note `frontend-next/` is untracked as a whole in this worktree, so Git cannot display a conventional tracked diff
- Focused grep: no invalid loader tokens or bare loading paragraphs in route loaders
- Independent read-only review + follow-up: no blockers; skeleton-width concern resolved by explicit full-width one-column LoadingState grid

No cloud changes, commits, or infrastructure actions performed.