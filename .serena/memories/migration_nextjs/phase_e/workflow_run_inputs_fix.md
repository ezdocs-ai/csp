# Phase E — RunWorkflowModal: read backend user_input outputs (text+image)

Date: 2026-07-29. Scope: `frontend-next/src/features/workflows/components/run-workflow-modal.tsx` + its pure helper + test ONLY. Did NOT touch RunForm, RunPanel, BatchCsvUpload, hooks, mappers, BFF routes, or `features/workflows/index.ts` (owned elsewhere).

Authority: backend `UserInputStep.outputs` (`dict[str, Any]`) serializes run params as `{ name: { type: "text"|"image" } }` (verified mem:migration_nextjs/phase_e/workflow_editor_ux_fix — Angular `run-workflow-modal.component.ts` L60-79 reads `userInputStep.outputs`). Legacy `inputs`/`fields` name-maps treated as text (back-compat).

## Problem fixed
Old inline `inputFields(definition)` read `step.inputs ?? step.fields` keys → zero fields rendered, because editor now serializes params to `outputs`. Editor_ux_fix mem flagged this as the known limitation to fix here.

## Files
- `components/extract-input-fields.ts` (NEW, pure, no React) — `extractInputFields(definition): {name,type}[]`. Reads `outputs` first (preferred), falls back to legacy `inputs`/`fields` name-maps. Accepts `{steps:[...]}` envelope OR bare step array. Discriminator regex `/user[-_]input/i` (both `user_input` + `user-input` + case variants). De-dupes by name (first-seen type wins), preserves order. Unknown/missing `type` → text. `inputFields(definition): string[]` back-compat shim (names only) so barrel `features/workflows/index.ts` `export { inputFields }` keeps resolving.
- `components/extract-input-fields.test.ts` (NEW, bun:test) — 12 tests: outputs text+image, unknown→text, legacy inputs, legacy fields, outputs-preferred, bare array, both discriminators, ignores non-user-input, de-dupe, malformed/empty, empty step, shim.
- `components/run-workflow-modal.tsx` (EDIT) — imports extractor; drops inline helper; re-exports `extractInputFields, inputFields` (keeps barrel working). Splits fields: text names → `RunForm fields={textFields}`; image fields → in-modal `<fieldset>` of number `<Input>`s (sourceAssetId) with hint "Image picker/upload not available here". Merges image values (Number-coerced) into submit payload. Batch unchanged: passes ALL field names (text+image) to `BatchCsvUpload fields=`.

## Image support decision (minimal in-scope)
RunForm only takes `string[]` (text inputs) — image NOT natively supported. Full Angular parity needs `ImageSelectorComponent` + `SourceAssetService.uploadAsset` + `ReferenceImage` shape (cross-feature, out of scope). Backend image arg union accepts a bare `int` sourceAssetId (audit mem H7). => Minimal in-scope extension: number input for asset ID in the modal. Honest hint surfaces the gap. `ponytail:` comment marks the upgrade path (ImageSelector + SourceAssetService).

## Validation
- `bun test src/features/workflows/components/extract-input-fields.test.ts` → 12 pass/0 fail.
- `bun test src/features/workflows src/features/workflow-run src/features/workflow-editor` → 71 pass/0 fail (no regression).
- `eslint` on all 3 files → exit 0.
- `tsc --noEmit` → 0 errors in changed source; only pre-existing repo-wide `bun:test` module notes (38, all in *.test.ts — bun is the runner).
- LSP diagnostics: extract-input-fields.ts + test clean; run-workflow-modal.tsx only pre-existing Tailwind v4 shorthand style warnings (codebase convention, unchanged).

## Single/batch flows preserved
Single: text → RunForm, image → modal fieldset, merged on submit. Batch: `BatchCsvUpload fields=` gets all names; CSV type-coercion of image columns to int is a known limit (CSV parser owned elsewhere, out of scope) — reported here, not fixed.

## Follow-up (approved, completed 2026-07-29): RunPanel + batch CSV coercion

Scope extended to `features/workflow-run/components/run-panel.tsx` + batch CSV coercion helper/tests within workflow-run. Did NOT touch run-workflow-modal.tsx (prev task file) or the barrel.

### Files added/changed (follow-up)
- `features/workflow-run/coerce-batch-rows.ts` (NEW, pure) — `coerceBatchRows(rows, imageFields): {rows, errors}`. Image columns → positive integer sourceAssetId; text/other columns pass through string. Rejects empty/non-numeric/zero/negative/float with actionable `Row N, column "X": ...` errors. Bad cells keep original value (preview honest); rows preserved (errors block submit upstream). No mutation of input.
- `features/workflow-run/coerce-batch-rows.test.ts` (NEW, 11 bun:tests) — int coercion, text passthrough, empty/non-numeric/zero/negative/float rejection, multi-row index, multi-column order, missing-field no-op, empty input, no-mutation.
- `features/workflow-run/hooks/use-csv-parser.ts` (EDIT) — signature `useCsvParser(inputFields, imageFields=[])`; calls `coerceBatchRows` after row construction, merges errors into `CsvResult.errors`. Dep array +imageFields.
- `features/workflow-run/components/batch-csv-upload.tsx` (EDIT) — +optional `imageFields?: string[]` prop, threads to `useCsvParser(fields, imageFields)`. Back-compat: callers omitting it get text-only (no coercion).
- `features/workflow-run/components/run-panel.tsx` (EDIT, rewritten) — removed inline `inputFields`; imports `extractInputFields` directly from `@/src/features/workflows/components/extract-input-fields`. Splits text/image: `textFields` → RunForm (RunForm takes string[], text-only), all names + `imageFields` → BatchCsvUpload (CSV gets image coercion). Reformatted minified JSX to multi-line for readability.

### Integration note
`run-workflow-modal.tsx` (prev task, out of this follow-up scope) still passes `fields.map(f=>f.name)` to BatchCsvUpload WITHOUT `imageFields` → its batch CSV does NOT coerce images (stays text/string). Acceptable: modal single-run already handles images via the number-input fieldset; modal batch image-coercion is a future 1-line add (`imageFields={imageFields}`) when scope allows. RunPanel is now the fully-coercing batch surface.

### Validation (follow-up)
- `bun test src/features/workflow-run/coerce-batch-rows.test.ts` → 11/0.
- `bun test src/features/workflows src/features/workflow-run src/features/workflow-editor` → 82/0 (was 71; +11 coercion, no regression).
- `eslint` on all 5 follow-up files → exit 0 (0 warnings after run-panel rewrite).
- `tsc --noEmit` → 0 errors in changed source (41 total, all pre-existing `bun:test` module notes in *.test.ts).
- LSP diagnostics: coerce-batch-rows.ts + use-csv-parser.ts + batch-csv-upload.tsx clean; run-panel.tsx only pre-existing Tailwind v4 shorthand style warnings (codebase convention).

## Still out of scope / future
1. Full image picker/upload (ImageSelector + SourceAssetService + ReferenceImage) when parity demands it — replace the modal + RunPanel number inputs.
2. RunPanel single-run image input: RunForm is text-only (`string[]`); image fields render nowhere in RunPanel single tab (modal covers single-run images via its fieldset). Known gap; RunPanel is the non-Angular standalone `/workflows/[id]/run` route.
3. Modal batch CSV image coercion (1-line `imageFields` prop add) when scope allows.
4. Barrel `features/workflows/index.ts` not updated to export `extractInputFields` (isolation — owned elsewhere); reachable via direct path import (RunPanel now uses direct import).
