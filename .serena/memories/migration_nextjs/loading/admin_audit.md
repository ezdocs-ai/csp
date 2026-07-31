# Admin Loading-Behavior Audit (frontend-next) — READ-ONLY

Scope: `frontend-next` admin route group `(admin)/admin/**` + `src/features/admin/**` + `src/features/source-assets/**` admin consumer. Studio + public audited for parity reference only. No files edited.

Method: grepped `Loading...`, `isLoading`, `isPending`, `disabled={`, `<Suspense`, `skeleton/Skeleton`, `spinner/Spinner`, `aria-busy`, `role="status"`; read all 8 admin `page.tsx`, `layout.tsx`, all admin components + hooks, existing `loading.tsx`/`error.tsx` inventory, `ui/index.ts` primitives. Consulted Next.js docs via Context7 (`/vercel/next.js`).

---

## 1. Next.js docs (Context7) — relevant rules

- `loading.tsx` (or `loading.js`) in a route segment wraps children in `<Suspense>`; Next renders it instantly from server as the fallback while dynamic content streams (`docs/.../loading.mdx`, `building.mdx`).
- Granular streaming = wrap the dynamic sub-tree in explicit `<Suspense fallback={...}>` close to the dynamic access; `loading.js` is for whole-page instant fallback (`streaming.mdx`). Placing `loading.tsx` high prevents the "dynamic work without Suspense" build error but falls back to full-page skeleton.
- Convention: `export default function Loading() { return ... }`. Accessible loading shells should expose a status (`aria-busy`, `role="status"`, or sr-only text), not a bare `<div>Loading…</div>`.
- `error.tsx` is the paired client boundary for thrown errors in a segment.

Codebase precedent already follows this: `app/(studio)/gallery/loading.tsx` uses `aria-busy="true"` + `animate-pulse` skeletons; `(studio)/fun-templates/loading.tsx` uses `animate-pulse` card skeletons (no `aria-busy`).

---

## 2. Findings — admin loading-behavior inventory

### 2a. Route loading boundaries — GAP
- **No `loading.tsx` exists in `(admin)` group** (`find_path app/**/loading.tsx` → only 4 files, all in `(studio)`). Admin pages are async server components that `await` DB/`requireApiClient`/`fetch` (`admin/page.tsx` awaits dashboard fetch; `users/page.tsx`, `ai-providers/page.tsx`, `ai-models/page.tsx` await API). On nav, user sees stale previous page + only the top `LoadingBar` (`src/components/ui/loading-bar.tsx`, `aria-hidden`, role="progressbar"). No segment-level fallback.
- **No `error.tsx` in `(admin)` group either** (`find_path app/**/error.tsx` → only `(studio)`).

### 2b. Literal "Loading…" / blank SSR fallbacks
| File | Line | Issue |
|---|---|---|
| `src/features/admin/components/ai-providers-admin.tsx` | L66 | `{loading ? <p ...>Loading…</p> : null}` — bare literal `<p>`, not `aria-live`/`role="status"`; screen readers silent |
| `src/features/admin/components/ai-models-admin.tsx` | L62 | Same: `{loading ? <p ...>Loading…</p> : null}` |
| `app/(admin)/admin/ai-providers/page.tsx` | L13-19 | SSR catch → `initial = []` → renders empty table (blank), client hook then shows "Loading…" |
| `app/(admin)/admin/ai-models/page.tsx` | L13-19 | Same blank-table SSR fallback |
| `app/(admin)/admin/users/page.tsx` | L13-18 | `users = { items: [] }` fallback → blank `UsersTable` |
| `app/(admin)/admin/page.tsx` | L49-53 | Dashboard fetch fail → empty `{ overview:{}, ... }` → blank charts |
| `src/features/admin/components/media-gallery-admin.tsx` | L174-186 (load) | `load()` fetch has **NO loading state at all** (no `setLoading` in component state list L163-172) — silent re-fetch on filter/sort/page, no feedback |
| `src/features/admin/components/tag-manager.tsx` | L54-73 | `load()` — same: no loading state, silent fetch |

### 2c. Disabled buttons w/ literal pending text
| File | Line | Pattern |
|---|---|---|
| `src/features/admin/components/cleanup-stuck-jobs-button.tsx` | L44-46 | `disabled={loading}` + `{loading ? "Cleaning…" : "Clean stuck jobs"}` — uses `<Button>` primitive (good) but no `aria-busy`/spinner |
| `src/features/admin/components/ai-providers-admin.tsx` | L92 | `disabled={busy === provider.id}` + `"Testing…"` — plain `<button>`, no spinner, no `aria-busy` |
| `src/features/source-assets/components/source-asset-admin.tsx` | L321-323 | `disabled={uploading}` + `"Uploading..."` — uses `<Button>`, no spinner/`aria-busy` |

Note: existing `Spinner` primitives are duplicated inline in `src/components/studio/generation-overlay.tsx` (L78) and `src/features/audio-studio/components/audio-studio.tsx` (L256) — both `aria-hidden` border-spin. Not shared/exported.

### 2d. Non-loading `disabled=` (correct, leave alone)
`admin-controls.tsx` Paginator prev/next/first/last (L75-81), `flow-prompt-box`, `menu.tsx`, `option-toolbar.tsx`, form-field `disabled={editing.id !== undefined}` in ai-providers/ai-models dialogs — these are state-disable, not pending-disable. Out of scope.

---

## 3. Proposed minimal shared accessible indicator

**One shared component + one shared route file. Reuse existing `--tri-*` tokens + `animate-pulse` precedent.**

### A. `src/components/ui/loading-indicator.tsx` (NEW, ~15 lines)
- `export function Spinner({ label = "Loading" }: { label?: string })` — the inline border-spin already used in 2 places, but with `role="status"` + sr-only `label`. Consolidates the duplicated `Spinner` fns.
- `export function LoadingText({ children }: { children: ReactNode })` — wraps the "Loading…" `<p>` with `role="status"` `aria-live="polite"`.
- Both server-component safe (no "use client", no hooks) so usable inside RSC `loading.tsx`.

### B. `<Button>` enhancement (optional, 1 prop)
Add `loading?: boolean` + optional `loadingLabel` to `ui/button.tsx` `ButtonProps`: when truthy, set `aria-busy` + prepend `<Spinner/>`. Lets cleanup-button / ai-providers Test / source-asset Upload drop their manual `disabled`/literal-text dance. Minimal: just add `aria-busy={loading}` passthrough if avoiding scope creep.

### C. Route fallback: `app/(admin)/admin/loading.tsx` (NEW, 1 file)
Mirrors `(studio)/gallery/loading.tsx` shape but table-aware: `aria-busy="true"` section + a row of `animate-pulse` bar skeletons matching the admin table columns. Single segment file covers ALL admin pages (dashboard, users, source-assets, templates, media-gallery, tags, ai-providers, ai-models). Prefer this over per-page `loading.tsx` (YAGNI).

→ Skipped: granular per-page `<Suspense>` boundaries, skeleton variants per page. Add when a page's above-the-fold shell needs instant paint (e.g. dashboard KPIs).

---

## 4. Exact files to change (admin priority order)

### P0 — route boundary (biggest UX win, 1 new file)
- **NEW** `app/(admin)/admin/loading.tsx`

### P1 — accessibility of existing indicators (replace literal `<p>Loading…</p>`)
- `src/features/admin/components/ai-providers-admin.tsx` L66 → `<LoadingText>Loading…</LoadingText>` (or keep text, add `role="status"`)
- `src/features/admin/components/ai-models-admin.tsx` L62 → same

### P2 — pending-button a11y
- `src/features/admin/components/cleanup-stuck-jobs-button.tsx` L44-46 → `loading` prop on `<Button>` (or add `aria-busy={loading}`)
- `src/features/admin/components/ai-providers-admin.tsx` L92 → convert plain `<button>` to `<Button loading={busy===provider.id} loadingLabel="Testing…">` 
- `src/features/source-assets/components/source-asset-admin.tsx` L321-323 → `loading` prop on `<Button>`

### P3 — silent-fetch feedback (media-gallery, tag-manager)
- `src/features/admin/components/media-gallery-admin.tsx` — add `loading` state around `load()` (L174-186), render `<LoadingText>` or skeleton row while pending
- `src/features/admin/components/tag-manager.tsx` L54-73 — same

### P4 — shared primitive + barrel export
- **NEW** `src/components/ui/loading-indicator.tsx`
- `src/components/ui/index.ts` L14 → add `export * from "./loading-indicator";`
- (optional) `src/components/ui/button.tsx` — add `loading` prop

### Non-admin consistency (mention only, lower priority)
- `app/(public)/login/page.tsx` L71-75 `<Suspense fallback={<p>Loading sign-in…</p>}>` — fine but could use shared `LoadingText`
- `(studio)` `loading.tsx` files: `gallery/loading.tsx` already `aria-busy`; `fun-templates/loading.tsx` missing `aria-busy` (add for parity)

---

## 5. Feature gate removal — `aiProviderRegistryAdmin`

### Why remove
- Flag ONLY hides the **nav links** for `/admin/ai-providers` + `/admin/ai-models` in `admin-subnav.tsx`. The **pages themselves are NOT gated** by the flag — they rely solely on `layout.tsx`'s `requireRole(["admin"])`. Reachable by direct URL regardless of flag. Inconsistent + dead weight vs migration goal (full admin parity; both pages have audit screenshots).
- Defaults `false` → in default config the AI registry links are hidden, contradicting parity.

### References (full surface — grep-confirmed, `useFeatureFlag`/`isEnabled`/`setEnabled` used NOWHERE else)
1. `src/features/admin/feature-flags.ts` — **DELETE whole file** (only export is the flag + its store)
2. `src/features/admin/__tests__/feature-flags.test.ts` — **DELETE whole file** (3 tests, all about the flag)
3. `app/(admin)/admin/admin-subnav.tsx`:
   - drop `import { useFeatureFlag } from "@/src/features/admin/feature-flags";` (L7)
   - drop `const AI_REGISTRY_HREFS = new Set([...])` (L20-21)
   - drop `const aiRegistry = useFeatureFlag(...)` + the `.filter(...)` (L25-26), render `ADMIN_SUBNAV` directly
   - file becomes a pure `"use client"` nav with `usePathname` only (could drop `"use client"` if no other client hooks — but `usePathname` needs it, keep)
4. `frontend-next/cloudbuild.yaml`:
   - L58-62 `export NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN=...` (build step)
   - L82 `--build-arg=NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN=...` (docker build)
   - L154 `_NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN: "false"` (substitution default)
   - Also check `frontend-next/Dockerfile` / `Dockerfile.dev` for the matching `ARG` (grep didn't hit ARG lines — verify `ARG NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN` and drop if present)

### Dead-code/tests after removal
- `feature-flags.ts` + `feature-flags.test.ts` = the only dead files. No other test imports the flag (`admin-page-render.test.tsx` checked — KPI-only, no flag ref; `ai-admin-mappers.test.ts` is mappers, not flag).
- Env var `NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN` becomes unused everywhere.

### Risk
- None functional: pages already admin-role-gated at layout. Removal only makes nav always show the 2 links (the actual product intent for parity). Backend `/api/admin/ai-providers` + `/api/admin/ai-models` already enforce admin on their own.

---

## 6. Open / verify-before-acting
- Confirm `frontend-next/Dockerfile`(+ `.dev`) has no `ARG NEXT_PUBLIC_FEATURE_AI_PROVIDER_REGISTRY_ADMIN` line (grep for build-arg targets).
- Decide whether `<Button loading>` prop is in-scope (touches shared primitive) or keep P2 as `aria-busy` passthrough only — minimal path is the latter.
- `media-gallery-admin.tsx` + `tag-manager.tsx` P3 adds new state — confirm product wants a visible indicator there (currently silent by design?).

No files were modified. This memory is the deliverable.
