# Phase E — Workflow Editor create/save runtime fix

## Status: COMPLETE — 422 eliminated (shared patch landed)

types.ts + mapper.ts patches were approved and applied. Config now persists on
step.config, flows through buildBackendStepConfig, and round-trips backend drafts.

In-scope work (all files) is DONE and green:
- `types.ts` — WorkflowStep gained `config?: Record<string, string|number|boolean|StepOutputReferenceDto>`.
- `mapper.ts` — toBackendStep enriches inputs/settings via buildBackendStepConfig (no more empty {}).
  Added nodeTypeToStepType (reverse of stepTypeToNodeType) for loaded-draft normalization.
- `hooks/step-configs.ts` — pure per-type config builder (STEP_FIELDS, STEP_OUTPUTS,
  defaultStepConfig, buildBackendStepConfig, missingRequired). coerce/missingRequired now
  idempotent for already-resolved ref objects (round-trip safe). 15 unit tests pass.
- `hooks/use-workflow-editor.ts` — CSRF via `/api/auth/csrf` (was cookie parse),
  tolerant `normalizeInitial` (handles both definition wrapper AND backend flat steps;
  folds backend inputs/settings into step.config, maps backend type discriminators to UI
  types via nodeTypeToStepType, flattens ref objects to "step::output" strings for display),
  captures created `id`, latches `draft.id`, returns `{id}` so the component can navigate,
  config consolidated INTO step.config (separate configs state removed),
  per-step `missingRequired` validation (blocks invalid submits).
- `components/workflow-editor.tsx` — `useRouter().replace('/workflows/{id}/edit')` after create
  (next save PUTs, no duplicates). Title keyed on `initial?.id`.
- `components/step-card.tsx` — typed config fields (prompt/model/aspect_ratio/temperature/
  brand_guidelines + ref selects for edit.input_images & vto.model_image). Style preserved.
- `components/step-list.tsx` — threads config + computes prior-step ref options via STEP_OUTPUTS.
- `components/step-palette.tsx` — disables any type lacking a STEP_FIELDS spec (none currently).

Components: step-card reads step.config (config prop dropped), step-list drops configs prop,
workflow-editor drops configs threading. UI style unchanged.

Tests: `bun test src/features/workflow-editor` → 22 pass (7 mapper + 15 step-configs). tsc + eslint clean on all edited files.

## Data flow (final)
UI step.config -> mapper.toBackendStep -> buildBackendStepConfig -> {inputs,settings} ->
WorkflowCreateDto -> server POST /api/workflows -> pydantic discriminated union (no 422).

Round-trip: backend returns WorkflowModel with flat steps (inputs/settings objects) ->
normalizeInitial folds inputs+settings into step.config, maps type discriminators back,
flattens ref objects to "stepId::output" strings for the ref <select>.

## Route contracts (unchanged)
- POST /api/workflows/create — server calls workflowDraftToCreateDto(body), POSTs to backend.
- POST /api/workflows/[id]/update — server calls workflowDraftToUpdateDto(body), PUTs to backend.
- Both were NOT modified; they already call the mapper which now enriches correctly.

## Unsupported / limitations
- All 7 palette types have STEP_FIELDS specs (none disabled).
- user_input output definitions are DYNAMIC (Angular lets users define them); this minimal
  editor does NOT surface that UI, so refs can only target prior generative-step outputs.
- edit input_images / vto model_image require a prior image-producing step (ref select); if
  none exists the field is disabled and missingRequired blocks save.
