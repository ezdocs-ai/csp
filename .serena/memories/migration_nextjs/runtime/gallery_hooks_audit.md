# Gallery (/gallery) "Rendered more hooks than previous render" — Hooks Audit

Date: 2026-07-30
Scope: csp/frontend-next — app/(studio)/gallery/** + src/features/gallery/** + shared render-path components.
Mode: READ-ONLY debug (no edits).

## Verdict
Audited `/gallery` list + `/gallery/[id]` detail client render tree. **No static Rules-of-Hooks violation found.**
- `bunx eslint --no-warn-ignored` (eslint-config-next incl. react-hooks/rules-of-hooks + exhaustive-deps) on whole `src/` + `app/` = ZERO violations.
- Manual review: every `use*` call in the render path is unconditional + top-level.

## Render path audited (all hook sites unconditional)
- GalleryView (src/features/gallery/components/gallery-view.tsx): 12 hooks, all top-level. Esc useEffect early-returns INSIDE effect body (not a hook) — safe.
- MediaCard (components/media/media-card.tsx): useState x2.
- Filters (components/media/filters.tsx): useRouter, useSearchParams, useState x3, useMemo x2.
- Pagination (components/media/pagination.tsx): useSearchParams; early-return `if (totalPages<=1) return null` AFTER hook — safe.
- MediaLightbox (components/studio/media-lightbox.tsx): useState(0); TWO early returns (`variant==="comparison"`, `!activeUrl`) both AFTER the hook — safe. ComparisonView/MediaStage/ActionsToolbar are child JSX components, not inlined fn calls.
- BulkActions / TagAssigner / CopyToWorkspaceDialog / SelectionBar / Dialog / Menu / Tooltip / LoadingBar / Sidebar / WorkspaceProvider / WorkspaceSwitcher / ToastProvider / GalleryDetail / DetailsPanel: all top-level hooks.

## Early-return-after-hook sites (canonical bug shape, prime regression targets — currently SAFE)
1. components/media/pagination.tsx:12-13  `useSearchParams()` then `if (totalPages<=1) return null`
2. components/studio/media-lightbox.tsx:66-78  `useState(0)` then 2x early return

## 5-7 plausible sources (distilled)
Most-likely ACTUAL runtime root (lint-invisible):
1. **useSearchParams WITHOUT Suspense** — Filters (filters.tsx:43) + Pagination (pagination.tsx:12) call useSearchParams; gallery page.tsx renders <GalleryView> with NO <Suspense>. Next docs: hook must be wrapped in Suspense or it forces CSR bailout of the client subtree up to nearest boundary; in Next16/React19 the prerender→client swap can surface as a hooks/reconciliation crash. CONFIRMED bug regardless of message.
2. **Stale .next / HMR artifact** — `rm -rf .next` + restart dev. Common false-positive.

Less likely:
3. Conditional hook in a transitive dep (not in audited set).
4. Duplicate React instances (node_modules dedupe).
5. Component-as-function-call inlining hooks (none found; all children are JSX).
6. Key/type instability causing fiber reuse (keys stable: compositeKey/group.title).
7. React19 `use(promise)` in try/catch (not used here).

## Minimal fix (NOT applied — read-only)
Wrap the two useSearchParams consumers in Suspense in app/(studio)/gallery/page.tsx:
```tsx
import { Suspense } from "react";
// ...
<Suspense fallback={null}>
  <GalleryView ... />
</Suspense>
```
(Filters + Pagination are both inside GalleryView, so one boundary covers both.)
If eslint-clean verdict holds after fix but crash persists → request browser console stack trace (component name + line) to pin; delete .next; check `npm ls react`.

## Regression test (proposed, not written)
Unit (bun test): render <Pagination totalPages={1}/> then totalPages={5} in same instance → no throw, hook count stable.
E2E (playwright): GET /gallery?workspaceId=... → no "Rendered more hooks" in console; pagination + filters hydrate.

## Open question for user
Need browser console stack trace (which component + line React blames) to reach >90% confidence on a SINGLE root cause. Static analysis alone = tree is compliant.

## Refs
- React rules-of-hooks: https://react.dev/reference/rules/rules-of-hooks (hooks not in conditions/loops/after early return).
- Next useSearchParams + Suspense: https://nextjs.org/docs/app/api-reference/functions/use-search-params
