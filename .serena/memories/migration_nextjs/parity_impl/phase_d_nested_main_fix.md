# Phase D — Nested `<main>` accessibility fix (frontend-next)

Fix: duplicate-main landmark a11y violations. Layouts own the single
`<main id="main-content">`; feature/page components rendered beneath
`(admin)` + `(studio)` layouts had their own `<main>` → replaced with
`<section>` (non-landmark, or named region where aria-label kept/added).
Classes, attrs, closing tags, state hooks, API routes all preserved.

## Approach
- Swap nested `<main>` → `<section>`; keep all className + attrs verbatim.
- `gallery-view` kept existing `aria-label="Gallery"` (region landmark, valid nested).
- Studio feature roots got `aria-label` (named regions): Image studio, Upscale
  studio, Virtual try-on studio, Workflow editor, Run workflow, Workflow detail,
  Workflow list.
- Page-level wrappers (h1 present) → plain `<section>` (no new landmarks).
- Loading fallbacks kept `aria-busy="true"`.
- Untouched (non-nested, correctly owned): `app/(admin)/admin/layout.tsx`,
  `app/(studio)/layout.tsx` (layout-owned mains), `app/(public)/login/page.tsx`
  + `app/visual/page.tsx` (standalone, no parent main).

## Changed files (19)
Feature components (src/features):
- gallery/components/gallery-view.tsx            (main→section, aria-label kept)
- image-studio/components/image-studio.tsx       (main→section aria-label="Image studio")
- upscale/components/upscale-studio.tsx          (main→section aria-label="Upscale studio")
- vto-studio/components/vto-studio.tsx           (main→section aria-label="Virtual try-on studio")
- workflow-editor/components/workflow-editor.tsx (main→section aria-label="Workflow editor")
- workflow-run/components/run-panel.tsx          (main→section aria-label="Run workflow")
- workflows/components/workflow-detail.tsx       (main→section aria-label="Workflow detail")
- workflows/components/workflow-list.tsx         (main→section aria-label="Workflow list")

App pages (app):
- (admin)/admin/source-assets/page.tsx           (main→section)
- (studio)/fun-templates/page.tsx                (main→section)
- (studio)/fun-templates/[id]/page.tsx           (main→section)
- (studio)/gallery/page.tsx                      (sign-in fallback main→section)
- (studio)/gallery/[id]/page.tsx                 (main→section)
- (studio)/gallery/[id]/error.tsx                (main→section)
- (studio)/gallery/[id]/loading.tsx              (main→section, aria-busy kept)
- (studio)/gallery/error.tsx                     (main→section)
- (studio)/gallery/loading.tsx                   (main→section, aria-busy kept)
- (studio)/settings/brand-guidelines/page.tsx    (main→section)
- (studio)/settings/workspaces/page.tsx          (main→section)

## Diagnostics (post-edit)
- Errors in all 19 changed files: **0**.
- 1 pre-existing error in `src/features/image-studio/hooks/use-image-state.ts`
  (NOT touched — unrelated, pre-existing).
- Warnings on several changed files are pre-existing gts/ESLint style warnings,
  not introduced by this change (no new errors).
- Verified: `grep <main` across app/+src/ → only 4 remain, all legitimate
  non-nested (2 layout-owned, login + visual standalone).

## Notes
- edit_file failed on very long single-line JSX (fuzzy match); used write_file
  for those small files (full content preserved verbatim except tag swap).
- Did NOT run pre-commit/docker (per scope: file edits only). Recommend user run
  `docker compose run --rm pre-commit run --all-files` + frontend lint before commit.
