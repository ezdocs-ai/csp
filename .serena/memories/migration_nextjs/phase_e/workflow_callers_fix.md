# Phase E — workflow caller wiring (WS-C hooks)

Date: 2026-07-29. Scope: WS-C ONLY — workflow hooks + their direct contract wiring. Did NOT touch workflow-editor, app/api routes, shared types/mappers, workbench.
Authority: mem:migration_nextjs/phase_e/workflow_contract_fix (BFF contract-ready) + backend OpenAPI WorkflowSearchDto/WorkflowSearchResponseDto + workspace resolution pattern in `src/lib/workspace` (used by TagManager: `Number(activeWorkspace.id)`).

## Goal
Unblock live execute/batch (were 4xx — no workspace_id) and rewire search to the backend `{limit,offset,name}` DTO + `{data}` response. Align run/batch state via the existing mappers the BFF already calls.

## Files changed (3 hooks)
- `src/features/workflows/hooks/use-workflows.ts`
  - `search(name="")` now POSTs `{limit:50, offset:0, ...(name?{name}:{})}` (typed `WorkflowSearchDto`) instead of `{query}`.
  - Response parsed via `workflowSearchToUi` (maps `WorkflowSearchResponseDto.data` → UI `Workflow[]`). Replaces the old `items`-or-array fallback.
  - Component API unchanged: `WorkflowList` still calls `search(query)`.
- `src/features/workflow-run/hooks/use-workflow-run.ts`
  - Resolves `const workspaceId = activeWorkspace ? Number(activeWorkspace.id) : 0` via `useWorkspace()` (same pattern as TagManager).
  - `submit` body now `{inputs, workspaceId}`. BFF `readWorkspaceId` injects `workspace_id` into `{args}`. `workspaceId` added to `submit` dep array.
- `src/features/workflow-run/hooks/use-workflow-batch.ts`
  - Same workspace resolution; `submit` body now `{batch, workspaceId}`. BFF routes batch array to `/batch-execute` with per-row `workspace_id`. `workspaceId` added to dep array.

## Execution state mapping
No new mapper added (scope forbids editing shared mappers). Run/batch BFF routes already produce UI-shaped output via existing `executionResponseToUi` (single → `{id,workflowId,status:"running"}`) and `batchResponseToUi` (SUCCESS→completed, FAILED→failed). Hooks consume those shapes unchanged: run `submit` returns `data as WorkflowExecution`; batch reads `data.executions` and counts on `status==="completed"|"failed"` (matches BFF output). State alignment therefore satisfied at the BFF layer; hooks just trust the mapped envelope.

## Not changed (intentional)
- `app/api/workflows/route.ts` (search BFF): stays raw passthrough — hook now sends the correct DTO and maps the response client-side, so no route edit needed (route edits out of scope anyway).
- `app/api/workflows/[id]/run/route.ts` / `[id]/executions/route.ts`: untouched; already contract-ready per workflow_contract_fix mem.
- `use-workflow-executions.ts`, `use-csv-parser.ts`: untouched (no workspace/search contract gap there).
- Components (`workflow-list.tsx`, `workflow-detail.tsx`, `run-panel.tsx`, `run-workflow-modal.tsx`): no edits needed — hook signatures preserved.

## Validation
- `bun test src/features/workflows src/features/workflow-run`: 8 pass / 0 fail (existing mapper tests; no new pure logic added so no new tests).
- ESLint on the 3 changed hooks: exit 0.
- `tsc --noEmit`: changed hooks clean. Only pre-existing repo-wide `bun:test` module errors in `__tests__/mapper.test.ts` (bun is the runner; tsc lacks bun types) — not introduced here.
- Diagnostics (LSP) on all 3 files: no errors/warnings.

## Still open (other phases, NOT this scope)
1. Execution LIST state mapping (`/api/workflows/{id}/executions` response): backend `state` enum (ACTIVE/SUCCEEDED/FAILED) vs UI `status` (running/completed/failed/failed). `use-workflow-executions.ts` + `use-workflow-run.ts` refresh still read raw backend list. OpenAPI `/executions` schema is `{}` (untyped) — verify real `state` values + response shape before adding a list mapper + wiring `workflow-detail.tsx` statusTone/filter. This is the only remaining workflow contract gap.
2. Per-step inputs/settings (WS-B editor rebuild): `toBackendStep` emits empty inputs/settings/outputs → 422 until editor produces real per-field config. Envelope + discriminator fixed in workflow_contract_fix; field config is the editor rebuild.
3. `app/api/workflows/[id]/execute/route.ts`: aligned for parity in prior phase but no client calls it (only `/run` used). Confirm dead → remove in WS-C cleanup.
