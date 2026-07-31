# Next.js AI Admin parity (Phase E)

Angular parity for AI Providers/Models admin + subnav gating.

## Feature-flag source determination
- Angular: `FeatureFlagsService` (frontend/src/app/common/services/feature-flags.service.ts) — in-memory signal, `aiProviderRegistryAdmin` defaults **false**, runtime `setEnabled`. No env.
- Next.js: previously NONE (no system, no env). Default must match Angular → false.
- Solution: minimal local store `src/features/admin/feature-flags.ts`. Mirrors Angular (default false, runtime `setEnabled`), optional `NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN` seed (defaults false). Reactive via stdlib `useSyncExternalStore` → client `AdminSubnav` re-renders on change.

## Files owned / changed
- `src/features/admin/feature-flags.ts` (NEW): `FeatureFlag` type (`"aiProviderRegistryAdmin"`), `isEnabled`, `setEnabled`, `useFeatureFlag`. No "use client" directive (importable server+client; hook only called from client).
- `src/features/admin/components/ai-providers-admin.tsx`: "Yes/No" → `SlideToggle` (from `./admin-controls`). New exported pure `providerToInput(provider, enabled?)` mapper (DRYs Edit handler too). `toggleEnabled` calls `update(id, providerToInput(...))` + `refresh`, errors via existing `setTestResult`.
- `src/features/admin/components/ai-models-admin.tsx`: "Yes/No" → `SlideToggle`. New exported pure `modelToInput(model, enabled?)` (DRYs Edit handler). New provider filter `<select>` ("All providers" + each) → `useState<number|undefined>` → passed to `useAiModels(providerFilter)` (hook already supports providerId filtering → reloads on change = Angular `providerChanged`). `toggleEnabled` update+refresh, errors via `console.error` (models component has no toast state).
- `app/(admin)/admin/admin-subnav.tsx`: `useFeatureFlag("aiProviderRegistryAdmin")`; filter out `/admin/ai-providers` + `/admin/ai-models` when false (mirrors Angular admin-layout `*ngIf`).
- `src/features/admin/index.ts`: re-export `isEnabled`/`setEnabled`/`useFeatureFlag` + `FeatureFlag` type.

## Tests (bun:test)
- `src/features/admin/__tests__/feature-flags.test.ts`: default false parity, setEnabled round-trip, no-op when unchanged.
- `src/features/admin/__tests__/ai-admin-mappers.test.ts`: `providerToInput`/`modelToInput` preserve fields + apply enabled override.

## Validation
- `bun --cwd frontend-next test src/features/admin` → 136 pass / 0 fail (incl. 5 new).
- ESLint on all changed files → clean (exit 0).
- TS diagnostics: feature-flags.ts clean; others only pre-existing Tailwind v4 `var(--...)` shorthand warnings (codebase-wide convention, not errors).

## Scope respected
- Did NOT touch: API routes, other admin components, shared UI primitives (`SlideToggle` only consumed). Pages `ai-models/page.tsx` / `ai-providers/page.tsx` untouched (routes still resolve; only nav hidden when flag off — matches Angular).

## Notes / follow-ups
- Toggle sends full PATCH input (hook `update` takes full `AiProviderInput`/`AiModelInput`), not Angular's partial `{enabled}`. Backend PATCH accepts full DTO. `secretRef: ""` on provider toggle = no-op (same as edit form).
- Models toggle errors only `console.error` (no snackbar state in that component). Angular shows a snackbar; add a shared toast if parity required later.
- To enable nav locally: `NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN=true` OR call `setEnabled("aiProviderRegistryAdmin", true)` at runtime.
