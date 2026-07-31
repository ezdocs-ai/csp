# Phase E — P0 workflow contract fixes (WS-E types + WS-A BFF)

Date: 2026-07-29. Scope: WS-E (shared types) + WS-A (BFF contract) ONLY. WS-B/C/D components/hooks untouched.
Authority: backend OpenAPI (`WorkflowCreateDto`, `WorkflowExecuteDto`, `BatchExecutionRequestDto/ResponseDto`, `BatchExecutionItemDto`, `BatchItemResultDto`, `WorkflowModel`, per-step `inputs`/`settings`) + Angular `workflow.service.ts` / `workflow-form.service.ts` / `workflow.models.ts` (`NodeTypes`, `WorkflowRunStatusEnum`).

## Design rule applied
Preserve existing UI APIs (hooks/components unchanged) by adding backend DTO types + PURE mappers; BFF routes call the mappers. UI types kept verbatim so `use-workflow-editor.ts`, `use-workflows.ts`, `use-workflow-run.ts`, `use-workflow-batch.ts`, `use-workflow-executions.ts`, list/detail/run components still compile.

## Files changed
Types (kept UI types, appended backend contract):
- `src/features/workflow-editor/types.ts`: `NodeType` (snake union), `StepStatusDto`, `StepOutputReferenceDto`, discriminated `BackendWorkflowStep` (7 members), `WorkflowCreateDto`/`WorkflowUpdateDto`.
- `src/features/workflow-run/types.ts`: `WorkflowExecuteDto`, `BatchExecutionItemDto/RequestDto`, `BatchItemResultDto/ResponseDto`, `ExecutionResponseDto`.
- `src/features/workflows/types.ts`: `WorkflowModelDto` (refs `BackendWorkflowStep`), `WorkflowSearchDto`, `WorkflowSearchResponseDto`.

Pure mappers (new) + bun:test contract tests:
- `src/features/workflow-editor/mapper.ts`: `stepTypeToNodeType`, `toBackendStep`, `workflowDraftToCreateDto`, `workflowDraftToUpdateDto`. (strips `definition` wrapper, maps short->snake discriminator, drops UI-only `label`.)
- `src/features/workflow-run/mapper.ts`: `toExecuteArgs`, `toExecuteDto`, `toBatchRequest` (`{items:[{row_index,args}]}`, workspace_id per row), `executionResponseToUi`, `batchResponseToUi` (SUCCESS->completed, FAILED->failed).
- `src/features/workflows/mapper.ts`: `workflowModelToUi` (steps -> `definition.steps` to preserve component API), `workflowSearchToUi`.
- Tests: `__tests__/mapper.test.ts` in each of the 3 feature dirs. 13 tests pass.

BFF routes (`app/api/workflows/**`):
- `create/route.ts`, `[id]/update/route.ts`: forward `{name,description,steps}` via mapper (no more `definition`).
- `[id]/run/route.ts`: single -> `/workflow-execute` `{args}` + workspace_id; batch -> `/batch-execute` `{items:[{row_index,args}]}` + per-row workspace_id; responses mapped to UI shapes the hooks read.
- `[id]/execute/route.ts`: aligned to `{args}` + workspace_id (was raw passthrough; accepts `{args}` or legacy `{inputs}`).
- `[id]/executions/route.ts`: forwards `limit`/`page_token`/`status` query to backend.

workspace_id source: client-resolved (no server workspace session — matches all other Next BFF routes which take `workspaceId` in body). `readWorkspaceId` accepts body `workspaceId` | `x-workspace-id` header | `workspaceId` query; injects only when present.

## Validation
- `bun test src/features/{workflow-editor,workflow-run,workflows}`: 13 pass / 0 fail.
- `tsc --noEmit`: workflow files clean (only repo-wide pre-existing `bun:test` module errors elsewhere).
- `eslint` on all changed files: exit 0.

## Caller follow-ups still required (out of this scope)
1. **workspace_id wiring (BLOCKS live execute/batch until done):** `use-workflow-run.ts` / `use-workflow-batch.ts` do NOT send workspaceId. WS-C must add `workspaceId: Number(activeWorkspace.id)` to the `{inputs}`/`{batch}` body (or `x-workspace-id` header) so the BFF injects `workspace_id`. Until then execute still 4xx on the backend (Angular requires it). BFF is contract-ready.
2. **Per-step inputs/settings (WS-B editor rebuild):** `toBackendStep` emits empty `inputs`/`settings`/`outputs`. Backend per-type steps require fields (e.g. `generate_image` needs `inputs.prompt`, `settings.{model,brand_guidelines,aspect_ratio}`) -> will 422 until the editor produces real per-field config. P0 wire envelope + discriminator fixed; field config is the editor rebuild.
3. **Search route not rewired:** `app/api/workflows/route.ts` still forwards `{query}` (backend `WorkflowSearchDto` wants `{limit,offset,name}`) and `use-workflows.ts` reads `data.items` (backend returns `{data}` via `WorkflowSearchResponseDto`). `workflowSearchToUi` mapper is ready; WS-C should wire search route + hook to `WorkflowSearchDto`/`workflowSearchToUi`.
4. **`WorkflowExecution.status` enum:** UI type still `running|completed|failed|stopped`; backend execution `state` uses `ACTIVE|SUCCEEDED|FAILED`. Status tone mapping in `workflow-detail.tsx` (WS-C) should align. OpenAPI `/executions` response schema is `{}` (untyped) — verify actual `state` values before finalizing.
5. **`execute/route.ts` usage:** no client calls it (only `/run` is used). Aligned for parity; can be removed if confirmed dead in WS-C.

## Out of scope (other Phase E gaps, see mem:migration_nextjs/phase_e/workflow_workbench_audit)
H1-H10 editor/run/list parity, workbench timeline H11-H13, M3 router.replace-after-create, M4 batch CSV column-mapping UI, M5 typed media resolver, M6 dead run-panel. These belong to WS-B/C/D.