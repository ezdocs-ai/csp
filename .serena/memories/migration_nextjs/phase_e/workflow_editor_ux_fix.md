# Phase E — Workflow Editor UX completion (Angular-parity, minimal)

## Status: COMPLETE — tests/tsc/eslint green (35 tests pass)

Scope owned: `frontend-next/src/features/workflow-editor/**` only. Backend Python + `features/workflows/**` untouched. mapper.ts/types.ts touched ONLY additively (user_input params demand it, per task exception).

## Contract decision (verified, not assumed)
Backend `UserInputStep` (src/workflows/schema/workflow_model.py): `inputs`/`settings` are empty models under `BaseDto(extra="forbid")` → CANNOT carry params. `outputs` is `dict[str, Any]` on BaseStep. yaml-gen (`workflow_service._generate_workflow_yaml`) reads `step.outputs.items()` to build workflow args; run resolves `${args.<name>}`. Angular parity confirmed: user_input step stores params as `outputs: { name: { type: "text"|"image" } }` (workflow-form.service initForm + editor prepareSteps + run-workflow-modal reads `userInputStep.outputs`).
=> Params serialize to user_input step **`outputs`**, identifier-normalized (toIdentifier = lower snake).

## Changes (all additive, existing config/save preserved)
- `types.ts` — +`InputParamType` ("text"|"image"), `InputParam` {name,type}; `WorkflowStep.inputParams?`.
- `hooks/transforms.ts` (NEW, pure) — `toIdentifier`, `paramsToOutputs` (params→outputs), `outputsToParams` (reverse, load round-trip), `reorder<T>` (immutable index move, no-op on bad indices). No React.
- `mapper.ts` — `toBackendStep`: user_input emits `outputs: paramsToOutputs(step.inputParams)`; others still `{}`. Imports transforms.
- `hooks/use-workflow-editor.ts` — `normalizeStep` reverse-maps `raw.outputs`→`inputParams` for user-input (round-trip); `makeStep` seeds `inputParams: []` for user-input; +actions `updateInputParams(id,params)` and `reorderSteps(from,to)` (index-based, for drag). Returned in hook API. `moveStep` kept for up/down buttons.
- `components/step-card.tsx` — `InputParameters` sub-section (user-input only): name Input + type select(text|image) + remove; "+ Add parameter". New optional prop `onUpdateInputParams`. Config fields/input-mode untouched.
- `components/step-list.tsx` — native HTML5 drag-reorder: draggable ⠿ grip (NOT whole card, so input text-selection works) + li onDragOver(preventDefault)/onDrop→onReorder; dragIndex via useState. Threads onUpdateInputParams. Up/down buttons retained.
- `components/outputs-panel.tsx` (NEW) — `OutputsPanel({execution?})`: status chip + step outputs when execution present; EmptyState zero-state when absent. `toneFor` regex maps any status string.
- `components/workflow-editor.tsx` — status chip (Saved/Draft from draft.id); ▶ Run button (disabled until saved, opens existing `RunWorkflowModal` from `@/src/features/workflows/components/run-workflow-modal`, passes serialized `{steps: workflowDraftToCreateDto(draft).steps}` so user_input outputs present); OutputsPanel rendered with `execution={null}` (no live execution-state hook in editor → honest zero-state, no fabrication). Save/navigate logic unchanged.
- `index.ts` — barrel exports InputParam/InputParamType.

## Tests (pure transforms + mapper integration)
- `hooks/__tests__/transforms.test.ts` (NEW, 11): toIdentifier cases, paramsToOutputs (snake + skip blanks), round-trip, outputsToParams malformed/null handling, reorder forward/backward/no-op/no-mutate.
- `__tests__/mapper.test.ts` +2: user_input inputParams→outputs serialization; empty-params→{}.
- Total feature: 35 pass (mapper 9, transforms 11, step-configs 15).

## Validation
`bun test src/features/workflow-editor` → 35 pass/0 fail. `tsc --noEmit` → only pre-existing `bun:test` module-resolution notes (all test files, env config) on source = clean. `eslint src/features/workflow-editor` → clean. Editor diagnostics → only Tailwind v4 shorthand style warnings (pre-existing codebase convention, unchanged).

## Known limitation (out of scope — features/workflows)
`RunWorkflowModal.inputFields(definition)` (in `features/workflows`, NOT owned here) reads user_input `step.inputs` keys to build the run form, but params live in `outputs`. So the run form currently shows zero param fields even though the editor serializes them correctly to outputs (backend-correct). Angular reads `outputs`; the Next.js inputFields diverged. Fix = change `inputFields` to read `.outputs ?? .inputs` — belongs to features/workflows phase, not this task. No fabrication: outputs panel + run-zero-state stay honest until then.
