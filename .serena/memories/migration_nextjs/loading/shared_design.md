# Shared Loading Primitive + loading.tsx Placement Design

Status: DESIGN ONLY. No edits made. Read-only inspection of `frontend-next/`.
Docs consulted: Next.js v16.2.9 (`loading.js` file convention, streaming, Suspense wrapping); React react.dev (ViewTransition a11y note: always honor `prefers-reduced-motion`).

## Current state (findings)

### Existing loading.tsx (4 files, all in `(studio)`, all hand-rolled)
- `app/(studio)/asset-detail/[id]/loading.tsx` — detail split skeleton
- `app/(studio)/gallery/[id]/loading.tsx` — detail split skeleton
- `app/(studio)/gallery/loading.tsx` — 6-tile media grid skeleton
- `app/(studio)/fun-templates/loading.tsx` — 8-card grid skeleton. **LATENT BUG**: uses `--tri-bg-subtle` which does NOT exist in `tokens.css` (renders no background). Defined tokens are `--tri-bg-surface`, `--tri-bg-surface-alt`, `--tri-bg-surface-tint`.

### Spinner pattern duplicated 4x, inconsistent
- `src/components/studio/generation-overlay.tsx` — `size-10`, white border, `aria-hidden`
- `src/features/audio-studio/components/audio-studio.tsx` — `size-5`, white border, `aria-hidden`
- `src/features/upscale/components/upscale-studio.tsx` — `size-8`, token border, NO label
- `src/features/vto-studio/components/vto-studio.tsx` — `size-8`/`size-12`, token border, `aria-label` (most accessible)

None use `role="status"` / `aria-live`. Three different sizes. Mixed a11y.

### Existing loading-bar.tsx
- `src/components/ui/loading-bar.tsx` — route-change top progress bar. Uses RAW Tailwind palette (`from-blue-500 via-violet-500 to-red-400`) — violates `migration_nextjs/design_mapping` rule "no raw hex/palette". Ship-own keyframe. Mounted in `(studio)/layout.tsx` AND `(admin)/admin/layout.tsx`, but NOT root or `(public)`. Flag for cleanup (not in scope here).

### Tokens available (tokens.css)
- Motion: `--tri-duration-ambient: 700ms` (sustained loops), `--tri-duration-fast/base/slow` 140/190/320ms (UI micro). `--tri-ease-standard/enter/exit/spring`.
- Brand: `--tri-brand-primary` (#087349 light / #26D07C dark), `--tri-border-default`, `--tri-text-secondary`.
- Spacing/radius/full set present.
- Reduced motion: `app/globals.css` L85-94 has GLOBAL `@media (prefers-reduced-motion: reduce)` forcing `animation-duration: 0.01ms !important` + `animation-iteration-count: 1 !important` on ALL elements. Safety net covers any spinner we add. Do NOT add competing override.

### Route groups (URLs)
- `app/(public)/login` — login only. No loading.tsx. No LoadingBar.
- `app/(studio)/` — `/`, `/audio`, `/video`, `/vto`, `/fun-templates`, `/imagen-upscale`, `/gallery`, `/gallery/[id]`, `/asset-detail/[id]`, `/settings`, `/workbench`, `/workflows`. Layout: dark studio shell + LoadingBar.
- `app/(admin)/admin/` — `/admin`, `/admin/{ai-models,ai-providers,media-gallery,source-assets,tags,templates,users}`. Layout: dark admin shell + AdminSubnav + LoadingBar.
- Root `app/layout.tsx`: async `getSession()` + `listWorkspaces()` before shell — cold loads currently show blank.

## Primitive design: ONE file `src/components/ui/loading.tsx`

Exports `Spinner` (atom) + `LoadingState` (composition). Re-export from `src/components/ui/index.ts`.

### API
```ts
type SpinnerSize = "sm" | "md" | "lg";  // 20 / 32 / 40 px (matches existing size-5/8/10)

interface SpinnerProps {
  label: string;        // REQUIRED sr-only text, announced via role=status
  size?: SpinnerSize;   // default "md"
  className?: string;
}

interface LoadingStateProps {
  label?: string;       // optional visible message
  ariaLabel?: string;   // default "Loading"
  size?: SpinnerSize;
  children?: ReactNode; // optional skeleton for shape-matching loaders
  className?: string;
}
```

### Spinner (atom)
- SVG circle + 90deg arc (not border-trick): frozen arc still reads as "loading" when reduced-motion kills animation. Existing border-spinners freeze to a full ring = ambiguous.
- `role="status"` + `aria-live="polite"` on wrapper span.
- `<span class="sr-only">{label}</span>` (better than `aria-label` for i18n).
- SVG `aria-hidden="true"`.
- `animate-spin` (Tailwind 1s) + inline `animationDuration: var(--tri-duration-ambient)` (700ms) — sustained loop, not a 140–320ms UI micro-interaction (design_mapping motion range is for transitions; spinner is functional loop, ambient token fits).
- Colors: track `--tri-border-default`, arc `--tri-brand-primary`. Both themes resolve automatically.
- Reduced motion: rely on existing global rule (no duplicate media query).

### LoadingState (composition)
- `<section aria-busy="true">` container (matches existing 4 loaders' convention).
- Flex row: `<Spinner>` + optional `<p>` visible label (`--tri-text-secondary`).
- `children` slot for tailored skeletons (gallery grid, detail split) — keeps primitive generic, skeletons stay in their loading.tsx.

## loading.tsx placement plan (cover every page, no duplicate code)

Next.js v16 rule (verified via docs): `loading.tsx` auto-wraps segment `page.tsx` in Suspense; NEAREST loader in segment tree wins, others cascade down.

### ADD (4 generic loaders, each one line importing the primitive)
- `app/loading.tsx` — root cold-load fallback (minimal centered `<LoadingState>`; covers session/workspace fetch in root layout before any group shell mounts).
- `app/(studio)/loading.tsx` — default studio loader. Covers `/`, `/audio`, `/video`, `/vto`, `/imagen-upscale`, `/settings`, `/workbench`, `/workflows` (8 routes currently without loaders).
- `app/(admin)/admin/loading.tsx` — default admin loader. Covers `/admin` + 7 admin subroutes (currently 0 loaders).
- `app/(public)/loading.tsx` — covers `/login`.

### KEEP (tailored shape-matching skeletons add value)
- `app/(studio)/gallery/loading.tsx` — media grid.
- `app/(studio)/gallery/[id]/loading.tsx` — detail split.
- `app/(studio)/asset-detail/[id]/loading.tsx` — detail split.
  These stay but swap hand-rolled markup to wrap `<LoadingState>` children for shared `aria-busy` shell.

### DELETE
- `app/(studio)/fun-templates/loading.tsx` — generic grid, covered by new `(studio)/loading.tsx` default. Deleting also removes the `--tri-bg-subtle` undefined-token bug.

### Net
- Before: 4 loading.tsx files, 4 routes covered, duplicated markup, 1 latent token bug.
- After: 7 loading.tsx files (4 generic one-liners + 3 tailored), ~22 routes covered, single primitive, bug removed.

## Out of scope / flagged for later
- `loading-bar.tsx` raw palette colors → swap to `--tri-brand-primary` / `--tri-brand-violet` / `--tri-brand-coral`.
- LoadingBar not mounted in `(public)` or root — login has no route-change indicator. Acceptable (single page) or hoist to root providers if desired.
- Replace 4 inline Spinner duplicates (generation-overlay, audio-studio, upscale-studio, vto-studio) with new `Spinner` import — separate refactor, not part of placement task.
- `app/loading.tsx` root loader must NOT assume dark studio theme (renders before group layout). Use neutral centered layout, no sidebar.

## Implementation order (when greenlit)
1. Create `src/components/ui/loading.tsx` (Spinner + LoadingState).
2. Add export to `src/components/ui/index.ts`.
3. Add 4 generic `loading.tsx` (root, studio, admin, public).
4. Refactor 3 tailored loaders to use `<LoadingState>` wrapper.
5. Delete `fun-templates/loading.tsx`.
6. Run `docker compose run --rm pre-commit run --all-files` (per GEMINI.md: containerized lint only).
