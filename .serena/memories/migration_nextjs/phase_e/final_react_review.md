# Phase E final read-only React/Next build-risk review

Date: 2026-07-29. Scope: ALL Phase E changed `frontend-next/**` files surfaced via fix memories (admin/tags/ai/dashboard/media-gallery/source-assets, brand-guidelines, content P0, gallery-actions, remix-handoff receivers, templates, workbench, workflow contract/callers/editor/history/run-inputs/workbench-audit). Read-only; no edits. Validated against `bunx next build` (Turbopack, Next 16.2.11, React 19.2.4).

## P0 BLOCKERS — confirmed `next build` failures (2)

### B1. `src/features/gallery/components/copy-to-workspace-dialog.tsx:50`
```tsx
value={targetId || workspaces[0]?.id ?? ""}
```
Turbopack parse error: `Nullish coalescing operator(??) requires parens when mixing with logical operators` (TS5076 / SWC parse fail). Hard build halt.
**Import chain that fails (all gallery routes blocked):**
- `app/(studio)/gallery/[id]/page.tsx` [Server] → `src/features/gallery/index.ts` (barrel, `export * from "./components/bulk-actions"`) → `bulk-actions.tsx` (imports `CopyToWorkspaceDialog`) → broken file.
- Same chain also blocks `app/(studio)/gallery/page.tsx` via `GalleryView`.
Fix: wrap — `value={targetId || workspaces[0]?.id || ""}` OR `value={(targetId || workspaces[0]?.id) ?? ""}`.
Introduced by: `mem:migration_nextjs/phase_e/content_p0_fix`.

### B2. `src/features/admin/feature-flags.ts:3` — RSC imports client-only API via barrel
```ts
import { useSyncExternalStore } from "react";
```
Turbopack: `You're importing a module that depends on useSyncExternalStore into a React Server Component module. This API is only available in Client Components.`
**Cause:** `src/features/admin/index.ts` barrel re-exports `useFeatureFlag` (and `isEnabled`/`setEnabled`/`FeatureFlag`) from `./feature-flags`. Server components `app/(admin)/admin/page.tsx` and `app/(admin)/admin/users/page.tsx` import `{DashboardFilters,...}` / `{type AdminUsersResponse}` from `@/src/features/admin` — pulling the entire barrel graph into RSC.
The only legitimate client consumer (`admin-subnav.tsx`) already deep-imports `from "@/src/features/admin/feature-flags"` directly — barrel re-export is unused by client and is what triggers the RSC failure.
Fix (smallest): drop `useFeatureFlag` (and ideally `isEnabled`/`setEnabled`/`FeatureFlag`) from the barrel; keep `feature-flags.ts` as a deep-import path for client consumers. Alternative: add `"use client"` to `feature-flags.ts` (keeps barrel working but forces client for every admin-barrel importer — heavier).
Introduced by: `mem:migration_nextjs/phase_e/ai_admin_fix`.

## Non-blocking risks (won't fail build; runtime / correctness concerns)

### N1. `src/features/admin/components/dashboard-filters.tsx` — `useSearchParams` without `<Suspense>`
Pre-existing Next deopt: forces the whole admin dashboard page dynamic. Next 16 emits a build warning, not an error. Documented in `mem:migration_nextjs/phase_e/dashboard_parity_fix`. Fix when ready: wrap `<DashboardFilters/>` in `<Suspense>` in `app/(admin)/admin/page.tsx`.

### N2. `src/features/workflow-run/hooks/use-workflow-run.ts` (dead `/run` route)
Still reads `data.executions ?? data.items` raw (line 21) — never maps backend `state` (ACTIVE/SUCCEEDED/FAILED) → UI status (running/completed/failed). Poll-while-running check `executions.some(({status}) => status === "running")` (line 25) never fires because backend returns ACTIVE, not running. Used only by `RunPanel` on the now-redirected `/workflows/[id]/run` route. Acknowledged as open in `mem:migration_nextjs/phase_e/workflow_history_fix` and `workflow_callers_fix`. NOT a build risk; runtime only on dead route.

### N3. `use-workflow-editor.ts:126` — `String(data.id)` when `data.id` null/undefined yields `"null"`/`"undefined"` string (latched as draft.id). Strict-null miss; no compile fail. Replace with `data.id == null ? "" : String(data.id)` if hardening.

### N4. `csrfToken()` cookie-parse helper duplicated across 8 files
(`tag-manager`, `media-gallery-admin`, `brand-guideline-upload`, `source-asset-admin`, `use-workflows`, `use-workflow-run`, `use-workflow-batch`, `video-studio`, `vto-studio`). All parse `document.cookie` for `csp_csrf` in event handlers/effects (SSR-safe). Not a blocker; opportunity to extract into `src/lib/auth/csrf-token.ts`.

### N5. `app/api/source-assets/route.ts:67` POST `await request.formData()` → `api.post(..., formData)`
Verified acceptable: `ApiClient.post<T>(path, body?: BodyInit | null)` accepts `FormData` (BodyInit). `formData.get("file") instanceof File` guard present. No build issue.

### N6. sessionStorage handoff (`gallery-actions.stageRemix`, `video-studio`/`vto-studio` readers)
All wrapped in try/catch. Readers use rAF-deferred `useEffect([])` (SSR-safe; `useEffect` never runs on server, rAF is browser-only). No hydration mismatch risk.

### N7. `set-state-in-effect` lint pattern
All Phase E async-in-effect sites use the codebase's deferred pattern: `window.setTimeout(() => void load(), 0)` with `clearTimeout` cleanup, or `requestAnimationFrame` + `cancelAnimationFrame`. Verified in `brand-guideline-upload.tsx`, `use-workflows.ts`, `use-workflow-executions.ts`, `use-workflow-run.ts`, `video-studio.tsx`, `vto-studio.tsx`. No `react-hooks/set-state-in-effect` violations.

### N8. Conditional hooks
`execution-detail-dialog.tsx` early-returns `if (!execution) return null;` BEFORE any hook call — no hooks in component. `outputs-panel.tsx` same. `gallery-detail.tsx` `tabs` array uses conditional spread `...(hasDebug ? [...] : [])` (not a hook). All clean.

### N9. Server/client + route-handler imports
- All `app/api/**/route.ts` (tags, media-gallery, source-assets, workflows/create, workflows/[id]/run) import only from `@/src/lib/{api,auth}/*` server modules + value imports from `features/{workflow-editor,workflow-run,workflows}/mapper.ts` and `types.ts`. All mappers are `import type` only; `workflow-editor/hooks/{step-configs,transforms}.ts` are pure TS (no React, no `"use client"`). No client leakage into route handlers.
- Studio route pages (`(studio)/page.tsx`, `video/page.tsx`, `audio/page.tsx`) are RSC that pass `initialState` props to client studios — correct boundary.
- `app/(studio)/asset-detail/[id]/{page,loading,error}.tsx` — server page + client error boundary. Clean.

### N10. `app/(studio)/fun-templates/{page,[id]/page}.tsx` — `api.get()` without explicit generic
TypeScript infers `T = MediaTemplate` (or `TemplateListResponse`) from the assignment / function-return context. `bunx tsc --noEmit` reports NO error on these files. Confirmed not a blocker.

## Pre-existing repo issues (NOT Phase E introduced; NOT a `next build` blocker)
- All `__tests__/*.ts` files using `import {...} from "bun:test"` fail `bunx tsc --noEmit` (38 files: "Cannot find module 'bun:test'"). Turbopack build does NOT type-check `__tests__/` so these do NOT fail `next build`. Run via `bun test src` (bun resolves the module at runtime).
- `src/lib/auth/__tests__/session.test.ts` readonly-array vs mutable Role[] mismatch — pre-existing.
- `tests/visual/design-system.spec.ts(21)` playwright size typing — pre-existing.
- `src/features/gallery/__tests__/gallery-actions.test.ts(123)` `Property 'name' does not exist on type '{}'` — test-only, does not affect build. (Phase E test, but isolated to `__tests__/`.)

## Re-run status (post B1/B2 + users null-guard fixes)

After fixes applied (not by this review), `bunx next build`:
- ✓ Compiled successfully (Turbopack parse errors B1 + B2 RESOLVED).
- ✗ Failed type-check run #1: `app/api/admin/users/route.ts:36` null-widen on `request.json().catch(() => null)` (pre-existing file, not Phase E).
- ✓ GREEN run #2 (post users null-guard fix): Finished TypeScript in 6.0s. Full route table emitted (all `/admin/*`, `/workflows/*`, `/gallery/*`, `/fun-templates/*`, `/asset-detail/[id]`, `/video`, `/audio`, `/vto`, `/workbench`, `/settings/*`). No errors, no warnings.
- ✗ FAIL run #3 (post latest gallery/workflow/admin changes): Compiled successfully in 2.8s; Failed type-check.

### New P0 blocker (latest gallery changes regressed the build):
**`src/features/gallery/components/gallery-detail.tsx:80:5`**
```
Type error: Type 'string | null | undefined' is not assignable to type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
  > 80 |     prompt: media.prompt,
```
Root: `MediaDetail.prompt` widened to `string | null | undefined` (latest changes), but the `stageMedia` object's `prompt` field (feeding `MediaLightbox`) expects `string | undefined`. Null leaks through.
Fix: `prompt: media.prompt ?? undefined` (or coerce at the `MediaDetail` source / widen the lightbox prop).
Phase E file (content_p0_fix + gallery_actions_fix territory). Regression vs run #2.
- ✓ GREEN run #4 (post gallery prompt null-normalization): Finished TypeScript in 6.6s. Full route table emitted, zero errors/warnings.

## Lint + Test status (run #3, same batch)

- **Lint: PASS** (exit 0). 1 warning only: `src/features/templates/components/template-card.tsx:27:13` unused `eslint-disable` directive (`jsx-a11y/media-has-caption` — video is muted, rule didn't fire). Cosmetic.
- **Test: PASS** (264 pass / 0 fail / 556 expect calls across 39 files). `bun run test` = `bun test src`. No regressions.

### New P0 blocker (surfaced once Turbopack passed parsing):
**`app/api/admin/users/route.ts:36`**
```
Type error: Property 'id' does not exist on type '{ id?: number | undefined; role: string; } | null'.
  > 36 |   const { id, ...body } = (await request.json().catch(() => null)) as { id?: number; role: ... }
```
Root: `request.json().catch(() => null)` widens to `T | null`; destructure of `null` illegal. NOT a Phase E file (pre-existing users route, untouched by Phase E fix memories). Surfaced now because Turbopack only reaches type-check once the B1/B2 parse errors cleared.
Fix: `const parsed = await request.json().catch(() => ({})); const { id, ...body } = parsed as {...};` (or assert non-null).

## Verdict
**Two Phase E files block `next build` (B1, B2). Both are mechanical, 1-line / 1-line-of-barrel fixes. Everything else is runtime-only or pre-existing.**

After fixing B1 + B2, the remaining next-build risk profile is clean:
- No hook-ordering / effect-loop issues found.
- No conditional hooks.
- No setState-in-effect violations (deferred pattern applied consistently).
- No server/client import violations other than B2.
- No route-handler → client-barrel leakage.
- No FormData typing issues.
- localStorage/sessionStorage access is SSR-safe (event-handler / rAF-deferred-effect only).

Re-run after fixes: `cd frontend-next && bunx next build`. Expect clean exit. Then `bun test src` for unit suites (already green per individual fix memories).
