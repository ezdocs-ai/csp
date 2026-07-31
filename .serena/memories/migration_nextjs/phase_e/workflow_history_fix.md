# Phase E — WS-C workflow list/history parity (debounce, pagination, state, detail modal)

Date: 2026-07-29. Scope: WS-C ONLY — `workflows/{components,hooks}/**` + `workflow-run/components/execution-history.tsx` + tests. Did NOT touch app/api routes, shared workflow types/mappers, workflow-editor, workbench.
Authority: closes H8/H9/H10/M1 from mem:migration_nextjs/phase_e/workflow_workbench_audit. Backend contract = openapi.json `GET /api/workflows/{id}/executions` ({limit,page_token,status} → {executions, next_page_token}; item `state` ACTIVE/SUCCEEDED/FAILED + start_time/duration) + `POST /api/workflows` WorkflowSearchDto ({limit,offset,name}) → WorkflowSearchResponseDto ({data,count,page,pageSize,totalPages}). Angular `workflow-status.pipe.ts` + `execution-history.component.{ts,html}` = UX source of truth.

## Goal
Verified parity for 4 audit items without widening scope: debounce workflow search ~500ms; pagination from existing response metadata (no dropped query); consistent backend execution-state mapping (ACTIVE/SUCCEEDED/FAILED); execution detail affordance using current data only.

## Files changed (7) + new (2)
Pure helpers (React-free, unit-tested) — NEW:
- `src/features/workflows/hooks/executions-query.ts` — `mapExecutionStateToStatus`, `normalizeExecution`, `parseExecutionsResponse`, `buildExecutionsQuery`, `ExecutionStatusFilter` type.
- `src/features/workflows/hooks/workflows-query.ts` — `buildSearchParams`, `parseSearchMeta`, `SearchPageInput/Meta` types.

Hooks:
- `src/features/workflows/hooks/use-workflows.ts` — REWRITE. Owns query+page state. Debounce 500ms (query change → page-1 search). Page/offset pagination via buildSearchParams(offset=(page-1)*pageSize, keeps name) + parseSearchMeta(totalPages). loadMore appends; query preserved. Removed dead `search` escape hatch + manual submit. Exposes {workflows,loading,loadingMore,error,query,setQuery,page,totalPages,hasMore,loadMore,remove}.
- `src/features/workflows/hooks/use-workflow-executions.ts` — REWRITE. `useWorkflowExecutions(workflowId, status)` (status = backend value, server-side filter so pagination never drops it). `buildExecutionsQuery` → limit/page_token/status. Cursor pagination via next_page_token; loadMore appends. `normalizeExecution` maps state→UI status on EVERY fetch path (initial/loadMore/poll). Polls while any execution status==="running". Exposes {executions,loading,loadingMore,error,hasMore,loadMore,refresh}.

Components:
- `src/features/workflows/components/workflow-list.tsx` — Input bound to query/setQuery (debounced auto-search, no submit button). Load More button when hasMore. New/Edit/Delete/Run flows unchanged.
- `src/features/workflows/components/workflow-detail.tsx` — statusFilter threaded into hook (server-side); removed client filter. statusTone typed via WorkflowExecution["status"] (mapped upstream, so consistent). Load More button. Execution cards → buttons opening ExecutionDetailDialog (current-data-only). Run/Batch/Edit + RunWorkflowModal preserved.
- `src/features/workflows/components/execution-detail-dialog.tsx` — NEW. Dialog modal using ONLY the list-item data (no /executions/{id} fetch — scope constraint). Shows status badge + id + started/ended + duration (from result stash) + error + raw output <details>. Mirrors Angular ExecutionDetailsModal surface minus the fresh fetch.
- `src/features/workflow-run/components/execution-history.tsx` — fixed unkeyed `<>` fragment (React key warning) via keyed `<Fragment>`; tone helper typed via BadgeTone. Reused only by dead `/run` route (run-panel) but kept compiling + correct.

Tests — NEW (pure, bun:test):
- `src/features/workflows/__tests__/executions-query.test.ts` — 11 tests: state mapping (ACTIVE/SUCCEEDED/FAILED/legacy/STATE_ prefix), normalizeExecution (duration stash, step_entries fold into result, null tolerance), parseExecutionsResponse ({executions,next_page_token}/items/data/array/empty/whitespace token), buildExecutionsQuery (limit/page_token/status/ALL drop).
- `src/features/workflows/__tests__/workflows-query.test.ts` — 6 tests: buildSearchParams offset calc + name gating + page clamp, parseSearchMeta (verbatim/derived totalPages/count fallback/null).

## Key decisions / constraints
- Shared `workflows/types.ts` WorkflowExecution = {id,workflowId,status,startTime?,endTime?,result?} — NO stepHistory, NO duration. Constraint forbids editing it. So `normalizeExecution` FOLDS backend step_entries + duration + error into `result` (unknown) so the modal surfaces them from current data without a type extension.
- Backend execution LIST response item shape (per Angular template): `{id, state, start_time, duration, ...}`. `state` normalized to UI {running,completed,failed,stopped} consistently in the hook; badge/`statusTone`/`tone` all key off the mapped UI status → ACTIVE/SUCCEEDED/FAILED display consistently across detail + history.
- "Without dropping query": (a) list — loadMore reuses nameRef so name survives pagination; (b) detail — status is a hook param, loadMore sends same status + next token; status reset re-runs initial load.
- No new fetches. Modal is current-data-only per scope (Angular's modal calls getExecutionDetails; ours intentionally does not).
- BFF routes untouched (out of scope): executions/route.ts already forwards limit/page_token/status; workflows search route already accepts the DTO (per workflow_callers_fix mem).

## Validation
- `bun test src/features/workflows src/features/workflow-run`: 24 pass / 0 fail (51 expect calls; 2 pre-existing mapper suites + 2 new pure suites).
- `tsc --noEmit`: workflow files clean (only pre-existing repo-wide `bun:test` module errors in `__tests__/*`).
- `eslint` on all 10 changed/new files: exit 0.
- LSP diagnostics: 0 errors project-wide. All warnings are Tailwind v4 `[var(--x)]` shorthand suggestions — repo-wide convention (GEMINI.md: keep style consistent), left as-is.

## Still open (out of this scope)
1. `use-workflow-run.ts` (workflow-run/hooks): still reads raw `data.executions ?? data.items` WITHOUT state→status mapping; its `status==="running"` poll check won't match backend `state`. Dead-route (run-panel, /run redirected). Flagged in workflow_callers_fix mem; not editable here (hooks scope was workflows/** + execution-history.tsx only).
2. Angular ExecutionDetailsModal step-level media resolver (MediaResolutionService + StepExecutionDetails) — not ported; modal shows raw JSON only (current-data constraint).
3. Workflow LIST search BFF route: still raw passthrough (hook sends correct DTO + maps client-side per workflow_callers_fix). No route edit needed.
4. `workflow-detail.tsx` refresh still toasts "Refreshed." (audit M7) — minor UX drift vs Angular; left untouched (not in the 4 fix items).
