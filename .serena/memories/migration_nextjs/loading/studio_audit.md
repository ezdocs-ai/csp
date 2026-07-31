# Studio Loading-State Audit (READ-ONLY)

Scope: `app/(studio)/**` loading indicators while RSC data streams. No files edited.

## Two existing layers

### Layer 1 — `LoadingBar` (client, pathname-driven)
`src/components/ui/loading-bar.tsx`. Mounted in BOTH `app/(studio)/layout.tsx:57` and `app/(admin)/admin/layout.tsx` (parity ✓).
- Triggers on `usePathname()` change, fixed 500ms timeout, then hides.
- `aria-hidden` + `role="progressbar"` (contradictory markup).
- Gaps:
  1. **First paint / hard load**: `prev.current === pathname` on mount → early return → never shows on initial SSR navigation. Only fires on subsequent client-side route changes.
  2. **Stream-unaware**: hides after 500ms regardless of whether data finished streaming. Understays for slow streams, overstays for fast ones.
  3. **Inaccessible**: `aria-hidden` hides from SR users; `role="progressbar"` lacks `aria-label`/`valuemin`/`valuemax`. Decorative only.

### Layer 2 — `loading.tsx` (Suspense fallback, stream-aware)
Existing skeletons use `aria-busy="true"` + `animate-pulse`. This is the correct accessible streaming indicator.
Present in 4 segments only:
- `gallery/loading.tsx`
- `gallery/[id]/loading.tsx`
- `asset-detail/[id]/loading.tsx`
- `fun-templates/loading.tsx` (list)

**MISSING** loading.tsx — these pages await data over network and render nothing during stream:
- `fun-templates/[id]/page.tsx` → awaits `getTemplate()` (real gap; sibling list has fallback, detail does not)
- `settings/brand-guidelines/page.tsx` → awaits `requireUser()`
- `settings/workspaces/page.tsx` → awaits `requireUser()`

**MISSING** loading.tsx — pages with no network fetch (only `await requireUser()` + render client studio component). Low-impact, but uniform fallback still desirable:
- `page.tsx` (studio root)
- `audio/`, `video/` (await searchParams only)
- `imagen-upscale/`, `vto/`, `workbench/` (shell only)
- `workflows/**`

No `Spinner`/`Skeleton`/`PageLoading`/`RouteLoading` primitive exists — `grep` found none. Only `LoadingBar` in `src/components/ui/index.ts`.

## Recommendation (smallest route-level / shared)

**One file: add `app/(studio)/loading.tsx`.**
App Router applies the nearest `loading.tsx` up the tree as the Suspense fallback for every nested page that lacks its own. A route-group-root fallback cascades to all 7+ uncovered studio segments instantly. Pages with their own `loading.tsx` (gallery, asset-detail, fun-templates list) override it — no conflict.

Skeleton body — reuse the existing accessible pattern already in repo:
```tsx
export default function Loading() {
  return (
    <section aria-busy="true" className="mx-auto max-w-[var(--tri-layout-content)] px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]">
      <div className="h-8 w-1/3 animate-pulse rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)]" />
      <div className="mt-[var(--tri-space-6)] h-64 animate-pulse rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface-alt)]" />
    </section>
  );
}
```
→ skipped: per-page bespoke skeletons (YAGNI; existing 4 already tune their own). Add when a specific route warrants a shaped skeleton.

**Keep `LoadingBar` as-is.** It already covers in-app client navigations across BOTH layouts; the new root `loading.tsx` covers RSC streaming + first paint + SR users. The two layers are complementary, not redundant.

## Optional a11y cleanup (separate, not required for "visible indicator")
If LoadingBar should also be SR-announced: remove `aria-hidden`, add `aria-label="Loading"` + `aria-valuemin={0}` + `aria-valuemax={100}`. Recommend NOT doing this — double announcement (LoadingBar + `aria-busy` skeleton) is noisier than the skeleton alone.

## Cross-check
- `(admin)` layout mirrors `(studio)` (LoadingBar mounted, no shared root loading.tsx) — same recommendation applies there if admin parity needed. Out of current scope.
- No inline `<Suspense>` boundaries found in studio pages — streaming is whole-page RSC, so route-level loading.tsx is the only effective lever.
