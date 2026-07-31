# Phase E — Brand Guidelines Parity (Next.js)

## Scope owned
- `frontend-next/src/features/brand-guidelines/**`
- `frontend-next/app/(studio)/settings/brand-guidelines/**`
- Workspace-switcher: NO edit needed — already has `MenuItem href="/settings/brand-guidelines"`.

## Backend contract (confirmed)
- `backend/src/brand_guidelines/brand_guideline_controller.py`:
  - `GET  /api/brand-guidelines/workspace/{workspace_id}` -> `BrandGuidelineResponseDto` (404 if none).
  - `GET  /api/brand-guidelines/{guideline_id}` -> single (poll target).
  - `POST /api/brand-guidelines/generate-upload-url` (JSON `GenerateUploadUrlDto`: filename, contentType, size, workspaceId).
  - `POST /api/brand-guidelines/finalize-upload` (JSON `FinalizeUploadDto`: name min3/max100, workspace_id, gcs_uri, original_filename) -> 202.
  - `DELETE /api/brand-guidelines/{guideline_id}` -> 204. Auth: workspace owner OR admin only.
- DTO casing: `BrandGuidelineModel` extends `BaseDocument` -> `alias_generator=to_camel`,
  `populate_by_name=True`. FastAPI emits camelCase JSON (`toneOfVoiceSummary`,
  `presignedSourcePdfUrls`, `colorPalette`, `sourcePdfGcsUris`, `errorMessage`).
  -> Next client type uses camelCase. (FinalizeUploadDto is plain BaseModel -> snake_case body.)

## Next BFF routes (already existed, unchanged)
- `app/api/brand-guidelines/route.ts`: GET `?workspaceId=` proxies workspace fetch;
  POST `{action:"generate-upload-url"|"finalize-upload"}` strips `action`, forwards.
  CSRF `verifyCsrf` on POST.
- `app/api/brand-guidelines/[id]/route.ts`: GET single, DELETE -> 204. CSRF on DELETE.

## Changes made
- `hooks/use-brand-guideline.ts`: extended `BrandGuideline` type with
  `colorPalette`, `sourcePdfGcsUris`, `presignedSourcePdfUrls`, `workspaceId`.
  Polling/upload logic untouched (preserve mandate).
- `guideline-status.ts` (NEW): pure `guidelineBadge(status, loading)` -> Angular
  dialog status labels (✓ Ready / ! Failed / ! Stopped / ○ Processing). Extracted
  for testability + reuse.
- `__tests__/guideline-status.test.ts` (NEW): bun:test, 3 cases (loading, terminal,
  fallback). Runnable check per lazy rule.
- `components/brand-guideline-upload.tsx` (rewrite): parity with Angular
  `brand-guideline-dialog.component`. Props `{userId, isAdmin}` from server page.
  - Initial fetch by active workspace on mount + workspace change (404 = empty state).
  - View mode: name + status badge, error msg, color palette swatches, Tone of Voice
    + Visual Style summaries (plain text, `whitespace-pre-wrap` + `line-clamp-3`
    show more/less — NO markdown dep), source PDF links (`Brand_Guideline_{i}.pdf`).
  - Delete (ConfirmDialog, danger) + Replace (toggles upload form) — canEdit gated.
  - Permission-aware: `canEdit = activeWorkspace.ownerId === userId || isAdmin`
    (matches backend delete auth + Angular `canPerformEditActionsOnBrandGuidelines`).
  - Processing/error state via Badge + Toast. Toast only on processing->terminal
    transition (prevStatusRef guard) so initial completed fetch stays silent.
  - Uses existing Toast/ConfirmDialog/Card/Field/Input/Badge/EmptyState.
- `index.ts`: re-exports `BrandGuidelineUploadProps`, `guidelineBadge`, `GuidelineBadge`.
- `app/(studio)/settings/brand-guidelines/page.tsx`: passes
  `isAdmin={session.roles.includes("admin")} userId={session.sub}`.

## Convention notes
- Effect-driven async fetch that setState synchronously before first await trips
  `react-hooks/set-state-in-effect`. Codebase fix: defer via
  `window.setTimeout(() => void load())` + cleanup clearTimeout
  (see `template-editor.tsx`, `use-workflows.ts`). Applied here.
- Tailwind `text-[var(--tri-...)]` shorthand warnings (`text-(--tri-...)`) are
  repo-wide style suggestions, NOT errors; whole codebase uses bracket form. Kept.

## Untouched (per scope)
- Upload/signed-URL/finalize request shapes (correct vs backend).
- Polling interval/timer logic in `use-brand-guideline.ts`.
- Workspace API/context/switcher.
- Backend brand_guidelines module.

## Validation
- `diagnostics`: clean on guideline-status.ts; brand-guideline-upload.tsx only
  Tailwind style warnings (consistent with repo).
- `eslint` on changed files: clean.
- `bun test src/features/brand-guidelines`: 3 pass.
- `bun test src`: 165 pass / 2 fail — failures are pre-existing test-isolation
  flake in `admin/components/template-mappers.test.ts` (`buildTemplateParams`),
  reproducible only in full-run, passes (10/10) in isolation. Admin feature,
  out of scope — NOT fixed.

## Invariant
Brand guideline client must read camelCase (backend to_camel alias). Workspace
fetch 404 = empty state (no error toast). Delete/Replace UI only when
owner/admin.