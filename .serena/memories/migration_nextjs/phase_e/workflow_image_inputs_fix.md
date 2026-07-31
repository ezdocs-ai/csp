# Phase E — Workflow image inputs: AssetPicker parity + batch coercion (R1/R6)

Date: 2026-07-29. Closes the two residual parity gaps left open by `mem:migration_nextjs/phase_e/workflow_run_inputs_fix` ("Still out of scope / future" items 1–3): the raw number-input image fields and the modal's missing batch-CSV image coercion.

Scope: `frontend-next/src/features/workflows/components/run-workflow-modal.tsx`, `frontend-next/src/features/workflow-run/components/run-panel.tsx`, NEW shared helper/component/tests under `features/workflow-run/`, + the `workflow-run` barrel. Did NOT touch RunForm, BatchCsvUpload, hooks, mappers, BFF routes, or the `features/workflows/index.ts` barrel (the latter still isolation-locked, owned elsewhere).

## What changed

### NEW pure helper — `features/workflow-run/workflow-image-selection.ts`
- `type SelectedImage = { id: number; name: string; previewUrl?: string }`.
- `toSelectedImage(asset: SourceAsset): SelectedImage` — coerces asset `id` (string) to int, prefers `thumbnailUrl` else `url` for preview.
- `selectionsToInputs(selections, fieldNames): Record<string, number>` — reduces selections to the submission payload: a bare int sourceAssetId per field. Omits unselected + non-integer (NaN) ids (parity with prior empty-number-input behaviour). No image bytes read — URLs only.
- Backend image arg union accepts bare int sourceAssetId (audit mem H7).

### NEW React component — `features/workflow-run/components/workflow-image-inputs.tsx`
- `WorkflowImageInputs({ imageFields, value, onChange })` — shared single-image picker surface. Renders a fieldset; per field: name + (preview img / placeholder) + `(#id)` + Change/Clear controls when selected, else Select-image button. Opens the existing shared `AssetPicker` (`type="image"`, `multiple={false}`, single). All controls native `<Button>` (Enter/Space keyboard-activatable) with `aria-label="... image for <field>"`. Clear deletes the key. Early-returns `null` when no image fields.
- Imports `RunInputField` type from `features/workflows/components/extract-input-fields` (no cycle: that module is a pure leaf, doesn't import workflow-run).

### Tests — `features/workflow-run/workflow-image-selection.test.ts` (7 bun:tests)
toSelectedImage int coercion + thumbnail-preferred + url fallback + non-string id; selectionsToInputs emits bare int / omits unselected / ignores out-of-fieldNames / drops NaN.

### EDITS
- `features/workflow-run/index.ts` (barrel) — added exports: `WorkflowImageInputs`, `selectionsToInputs`, `toSelectedImage`, `type SelectedImage`. (Cross-feature modal imports these from the barrel, matching how it already imports BatchCsvUpload/RunForm.)
- `features/workflows/components/run-workflow-modal.tsx` — replaced `imageInputs: Record<string,string>` number-`<Input>` fieldset with `imageSelections: Record<string,SelectedImage>` + `<WorkflowImageInputs>`. submit merges `{ ...inputs, ...selectionsToInputs(imageSelections, imageFieldNames) }`. **R1 FIX**: BatchCsvUpload now gets `imageFields={imageFieldNames}` (was omitted → CSV image columns were not coerced). Removed now-unused `Field, Input` imports. `imageFields` = objects; `imageFieldNames` derived. Re-exports of extractor unchanged.
- `features/workflow-run/components/run-panel.tsx` — **R6 FIX**: previously rendered NO image input in single tab. Now: `imageFields` = objects (was names), `imageFieldNames` derived, `imageSelections` state, `<WorkflowImageInputs>` in single tab, submit merges via `selectionsToInputs`. BatchCsvUpload `imageFields` now `imageFieldNames` (names still). Imports helper locally (same feature).

## Parity coverage now
- Single run (modal + panel): text → RunForm (unchanged), image → AssetPicker single-select with name/preview + clear/change + keyboard labels; submitted value = bare int sourceAssetId.
- Batch CSV (modal + panel): `imageFields` passed → `coerceBatchRows` coerces image columns to positive int.
- Text inputs / single / batch tabs all preserved.

## Validation
- `bun --cwd frontend-next test src` → **249 pass / 0 fail** (was 249 incl +7 new; 518 expects). No regression across workflows/workflow-run/workflow-editor.
- `eslint` on all 6 touched files → exit 0, 0 warnings.
- `tsc --noEmit` → 41 total errors, ALL pre-existing: 40 `bun:test` module notes in *.test.ts (bun is the runner) + 1 pre-existing e2e type error in `tests/visual/design-system.spec.ts` (unrelated). **0 new errors** in changed source.
- LSP diagnostics: changed files show only Tailwind v4 shorthand style suggestions (`gap-(--x)` etc.) — codebase convention, identical to every existing component; no errors.

## Notes / decisions
- Asset `id` → `Number()` then `Number.isInteger` guard on submit. SourceAsset.id is a string; if a backend ever emits a non-numeric id, the field is silently omitted rather than submitting NaN (safer than the old `Number(value)` which could emit NaN/0).
- Empty image selection = field omitted from payload (preserves old single-run semantics; batch still requires positive int via coerce-batch-rows).
- `--tri-radius-md`, `--tri-bg-surface-alt`, `--tri-space-*` tokens verified defined (used widely; globals.css maps radius/sm/md/lg/xl/2xl).
- Component test deliberately skipped (suite has no React component tests; UI is thin + logic lives in the tested pure helper, per the one-runnable-check rule).
