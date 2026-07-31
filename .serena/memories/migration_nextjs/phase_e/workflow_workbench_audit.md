# Phase E — read-only audit: workflows + workbench (Angular ↔ Next)

Date: 2026-07-29. READ-ONLY. Re-audited CURRENT files (not memory).
Angular = `frontend/src/app/{workflows,workbench}/**` = source of truth.
Next = `frontend-next/{app/(studio)/workflows,app/api/workflows,app/(studio)/workbench,app/api/workbench,src/features/{workflows,workflow-editor,workflow-run,workbench}}/**`.
Backend contract = `frontend-next/openapi.json` (workflow + workbench paths/schemas read in full).
Scope: workflow list, editor, detail/history/run/batch, route journeys; workbench assets/tools/properties/timeline/render.

## TOP-LINE VERDICT
Wave 2/4/5/6 surfaced UI shells + pure timeline model. **Workflow create/run path still CANNOT produce a backend-valid request** — step-type model + execute-DTO contract diverge from OpenAPI. Workbench render path OK; interactive timeline editor still missing most Angular affordances despite W6 "interactive UI" claim.

---

## BLOCKERS (P0 — workflows non-functional end-to-end)

### B1. WorkflowStep type model diverges from backend discriminated union
- Next `StepType = "user-input" | "text" | "image" | "edit" | "video" | "vto" | "audio"` (`workflow-editor/types.ts`).
- Backend `WorkflowCreateDto.steps[]` is a `oneOf` discriminated by `type` with values `user_input | generate_text | generate_image | edit_image | generate_video | virtual_try_on | generate_audio` (snake_case full names). Angular `NodeTypes` enum matches exactly.
- Each step schema requires `{stepId, type, inputs, settings, outputs}` and per-type `inputs`/`settings` shapes (e.g. `GenerateImageInputs.prompt`, `GenerateImageSettings.{model,brand_guidelines,aspect_ratio,resolution}`). Next `WorkflowStep = {id, type, label, inputs[{mode,value,sourceStepId}], outputRef}` is invented and has no `settings`/`outputs`/`stepId`.
- `useWorkflowEditor.save()` POSTs `{name, description, definition:{steps}}`. Backend expects `{name, description?, steps}`. Field name `definition` not in DTO; nested `steps` under `definition` will 422.
- **Effect: workflow create/update always 422. Editor cannot save a runnable workflow.**

### B2. WorkflowExecuteDto contract mismatch (single run)
- OpenAPI: `POST /api/workflows/{id}/workflow-execute` body = `WorkflowExecuteDto = {args: object}` (required).
- Next BFF `app/api/workflows/[id]/run/route.ts` (single path) forwards `JSON.stringify({ inputs: body.inputs })` → backend sees `{inputs: ...}`, missing `args` → 422.
- Angular `WorkflowService.executeWorkflow` wraps payload as `{args: {...userInputs, workspace_id}}`. **Next never injects `workspace_id`** (no WorkspaceStateService equivalent on the run path). Even if `args` were fixed, executions would run with no workspace context → executor 4xx/500.
- Next `app/api/workflows/[id]/execute/route.ts` likewise forwards raw body → same `args` gap.

### B3. Batch endpoint invented; real `/batch-execute` unused
- OpenAPI: `POST /api/workflows/{id}/batch-execute` body = `BatchExecutionRequestDto = {items: [{row_index: int, args: object}]}` → `BatchExecutionResponseDto = {results: [{row_index, execution_id?, status:"SUCCESS"|"FAILED", error?}]}`.
- Angular `WorkflowService.batchExecuteWorkflow` posts exactly that (enriches each `args` with `workspace_id`).
- Next `run/route.ts` batch branch loops `client.post(/workflow-execute, {inputs})` per row via `Promise.all`. Wrong endpoint, wrong per-row shape (`inputs` not `args`), no `row_index`, no `workspace_id`, non-atomic. Response shape also mismatched (`{executions}` synthesized client-side in `use-workflow-batch.ts`).
- **Effect: CSV batch never reaches the batch executor; even fixed B2 per-row still fails.**

---

## HIGH (P1 — feature/parity gaps, workflows)

### H1. Editor missing User Input Parameters section
Angular editor defines workflow inputs via `FormArray definitions` (`userInput.settings.definitions`) of `{id,name,type:'text'|'image'}`, syncs to `userInput.outputs` (`workflow-form.service.ts syncOutputs`). These power the run form schema. Next editor has no equivalent → `inputFields(definition)` in `run-workflow-modal.tsx` regex-scans a definition the editor never produces → always empty.

### H2. Editor missing Outputs panel (right 1/3)
Angular: 4 states (zero / running / completed / per-step) with `<app-step-execution-details>` resolver + media URL map. Next `workflow-editor.tsx` is single-column: name + description + StepPalette + StepList + Save. No outputs column, no step selection, no execution state surface.

### H3. Editor missing drag-and-drop reorder
Angular: `cdkDropList` + `cdkDrag` with `[cdkDragDisabled]` in read-only mode. Next: ↑/↓ buttons only (`step-card.tsx`). Functional but not parity; ordering of execution-critical steps needs drag UX.

### H4. Editor missing run-from-editor + status chip
Angular: header has Back + inline editable title/description + status chip (`currentExecutionState | workflowStatus`) + Run + Save. Run opens `RunWorkflowModalComponent`. Next `workflow-editor.tsx` has only static title + Save. No Run, no status chip, no execution state.

### H5. Editor step forms invented, no per-type config
Angular: `AddStepModalComponent` (modal node palette) + `generic-step` with `STEP_CONFIGS_MAP`-driven inputs/settings per type (model/aspect_ratio/resolution/brand_guidelines/prompt/input_images/start_frame/etc). Next `step-palette.tsx` is 7 flat buttons; `step-card.tsx` exposes only `label` + an invented `mode: fixed|linked|mixed` select + `sourceStepId` — none of which exist in Angular or backend DTO. No way to set prompt, model, references, aspect ratio, etc.

### H6. `prepareSteps` serialization logic missing
Angular serializes form → backend by: (1) prepending a `user_input` step built from `userInput.outputs`; (2) transforming user-input output keys from display name ↔ identifier (`toIdentifier`/`toDisplay`); (3) stripping `_definitionId` from linked references; (4) cleaning array/object inputs. Next has none of this. Even with B1 fixed, payload shape wrong.

### H7. RunWorkflowModal: image-typed inputs unsupported
Angular `run-workflow-modal.component.{html,ts}`: per-input renders text field OR image picker (drop-zone + `ImageSelectorComponent` dialog + drag-drop upload via `SourceAssetService.uploadAsset` + thumbnail preview + clear button). Image input values are `ReferenceImage` shapes (`sourceAssetId` or `sourceMediaItem`). Next `run-form.tsx` renders a text `<Input>` for every field regardless of type → image inputs receive raw strings, backend 422 on `inputs.<image_field>` union (`StepOutputReference | ReferenceMediaOrAsset | int | []`).

### H8. WorkflowDetail: no execution details modal
Angular `execution-details-modal` (per-execution dialog with summary, error pre-block, collapsible step list, `<app-step-execution-details>` media resolver). Next `workflow-detail.tsx` renders flat execution cards with status badge + id + start time; click does nothing. No drill-in.

### H9. Workflow list: missing paginator + debounce
Angular: `mat-paginator [pageSizeOptions]=[5,10,25,100] showFirstLastButtons` + `studio-search-filter` debounced 500ms (`filterSubject.pipe(debounceTime(500),distinctUntilChanged)`). Next `workflow-list.tsx`: no paginator, manual submit button, no debounce. List sizes are small today; still parity gap.

### H10. Executions pagination ignored
OpenAPI `GET /api/workflows/{id}/executions` supports `limit, page_token, status`. Next BFF `app/api/workflows/[id]/executions/route.ts` discards the query string entirely; `use-workflow-executions.ts` fetches one page client-side. Angular uses cursor-paginated `nextPageToken` + Load More button. Status filter is client-side in both (match) but server-side param unused in Next.

---

## HIGH (P1 — workbench timeline editor)

### H11. Timeline editor missing core affordances (wave 6 claim overstated)
Angular `workbench.component.html` (L600–930) timeline has:
- Tool rail with **5** tools (gallery/audio/stories/edit/agent). Next `workbench.tsx` ships 4 (agent omitted by decision; audio/stories disabled with hint — match).
- Zoom slider (`studio-slider` bound to `pixelsPerSecond`). Next `timeline-editor.tsx` hardcodes `pixelsPerSecond = 72`.
- Split-selected-clip button (`content_cut`, `canSplit()`). Next: none.
- Delete-selected-clip button. Next: none (trim/move only).
- Per-track eye/lock toolbar buttons (`studio-toolbar` + `studio-toolbar-button`). Next: none.
- Thumbnail strip on video clips (5 repeats of `getAssetThumbnail`). Next `clip-block.tsx`: not inspected but `timeline-editor.tsx` passes only clips/duration; no asset thumbnail prop wiring visible at this layer.
- Audio clip waveform graphic (random-height bars). Next: not present.
- Trim handles (`.cursor-ew-resize` edge handles). Next: trim via `onTrim` callback exists in prop signature but affordance prominence unverified at clip-block layer.
- Click-to-select ring (`selectedClipId` + ring classes). Next: `selectedId` state exists in `timeline-editor.tsx`; selection ring at clip-block layer unverified.

### H12. Workbench ships non-Angular `FilterControls`
`workbench.tsx` renders `<FilterControls filters onChange>` in the preview column. Angular workbench has no preview-side brightness/contrast/saturation controls (PropertiesPanel sliders exist but are decorative and not bound to render). Decision needed: remove FilterControls for parity, or keep as deliberate Next extra (currently undocumented).

### H13. PropertiesPanel: no binding to render pipeline
Both Angular and Next PropertiesPanel sliders are decorative (Angular hardcoded `value=50` with broken `valueText`; Next backed by local state but not passed to `RenderPanel`). Parity-OK but documented as `ponytail:` in Next. No backend per-clip color grading exists.

---

## MEDIUM (P2)

### M1. Status enum divergence
- `WorkflowRunStatusEnum` (Angular) = `running|completed|failed|canceled|scheduled`. Backend execution `state` (per Angular template + service) uses `ACTIVE|SUCCEEDED|FAILED` for executions list filter and `state` field on `ExecutionDetails`.
- Next `WorkflowExecution.status = "running"|"completed"|"failed"|"stopped"`. `stopped` invented; `canceled`/`scheduled`/`ACTIVE`/`SUCCEEDED` not modeled. `statusTone()` and filter mapper in `workflow-detail.tsx` only handle 4 states → unknown states render neutral. Schema-not-verified (OpenAPI `/executions` response schema is empty `{}`).

### M2. WorkflowModel type drops fields
Next `Workflow = {id,name,description?,definition?,status?,createdAt?,updatedAt?}`. Angular/backend `WorkflowModel = {id,name,description,steps,createdAt,updatedAt,userId}`. Next exposes `definition?` (unknown) instead of `steps`. `userId` missing. `WorkflowDetail` doesn't render owner.

### M3. Route journeys — converged but one regression
- `/workflows` list → card click → `/workflows/[id]` (executions primary surface). ✅ matches Angular's `/workflows/:id/executions`.
- Edit link → `/workflows/[id]/edit`. ✅ matches `/workflows/edit/:id` (path shape change, documented).
- `/workflows/[id]/run` → `redirect(/workflows/[id])`. ✅ invented route collapsed.
- **REGRESSION**: `useWorkflowEditor.save()` returns a `WorkflowDraft` but the editor does NOT call `router.replace` to swap `/workflows/new` → `/workflows/[id]/edit` after first save. Angular does (`router.navigate(['/workflows','edit',response.id], {replaceUrl:true})`). Reload after create loses draft + shows blank New form. Also `draft.id` is never set post-save → subsequent saves hit `create` again, duplicating.

### M4. BatchCsvUpload UI parity
Next `batch-csv-upload.tsx`: file input + 5-row table preview + error list. Angular `batch-execution-modal.component.html`: drag-drop upload zone + column auto-mapping UI (mapped ✓ / unmapped ?) + validation summary (missing inputs) + post-run results list with per-row `row_index`/`execution_id`/status/error tooltip. Functional gap on top of B3.

### M5. MediaOutputResolver fragility
Next `media-output-resolver.tsx` `mediaIds()` walks result recursively, keeps keys matching `/media|asset|item/i`, validates values via `/^[\w-]+$/`. Angular `MediaResolutionService.resolveMediaUrls` is step-type-aware (`stepTypeMap`) and uses proper `step_outputs` shape. Next's heuristic misclassifies nested non-id strings and misses typed resolution paths. `RunPanel` (which renders it) is no longer routed but the modal in `workflow-detail.tsx` doesn't surface media outputs at all.

### M6. ExecutionHistory (workflow-run) is dead-but-present
`run-panel.tsx` + `execution-history.tsx` only reachable via the now-redirected `/workflows/[id]/run` route. `ExecutionHistory` uses invalid `<>` fragment key pattern (React key warning). Either delete with the route redirect or repurpose for H8.

### M7. WorkflowDetail button semantics
- Run button enabled unconditionally; Batch + Edit gated on `canEdit`. Angular: Run + Batch always visible to permitted users, Edit gated on `isUserAdmin()||isUserWorkflows()`. Match.
- "Refresh" shows toast "Refreshed." on every click — Angular has no toast on manual refresh (just spinner swap). Minor UX drift.

---

## LOW (P3 — cosmetic / verified OK)
- L1. `formatTimeAgo` ported verbatim ✅.
- L2. `ConfirmDialog` replaces Angular `ConfirmationDialogComponent` (350px). Parity ✅.
- L3. `EmptyState` for empty list/executions ✅.
- L4. Role gating: `middleware.ts` blocks `/workflows*` unless `admin||workflows` ✅ (fixed in earlier wave). Pages re-assert via `requireRole(["workflows","admin"])`. Match Angular's `WORKFLOWS|ADMIN` route data.
- L5. Workbench role gating: Next `requireUser()`. Angular `AuthGuardService` (logged-in). Match (no role requirement in Angular).
- L6. CSRF: all Next mutation routes verify `csp_csrf` cookie vs `x-csrf-token` header ✅. Client hooks read `csp_csrf` ✅.
- L7. Workbench render: BFF requires `clips` + `output_format`, forwards to `/api/workbench/render` with 10-min `AbortSignal.timeout`, returns blob with `content-disposition` + `nosniff`. Backend `TimelineRequest` requires only `clips`; defaults `output_format=mp4`, `width=1920`, `height=1080`. Next omits width/height (backend defaults OK). Render path functional ✅.
- L8. PropertiesPanel slider labels match Angular's full set (Lighting 6, Colors 4, Effects 6, Detail 3) ✅. Aspect ratio buttons (16:9/9:16/1:1/4:3) ✅.
- L9. AssetsPanel upload/add-to-timeline/delete-on-hover/cloud-button/video-audio tabs/drive-disabled/upload-button ✅. Matches Angular minus custom SVG icons (replaced with glyphs).

---

## DISJOINT IMPLEMENTATION WRITE SETS (for parallel fix waves)

Sequencing rule: **WS-E first** (shared types unlock everything), then WS-A/B/C/D in parallel.

### WS-E (BLOCKER, do first — shared types)
Files:
- `src/features/workflows/types.ts`
- `src/features/workflow-editor/types.ts`
- `src/features/workflow-run/types.ts`
Scope: Align `StepType` to `NodeTypes` snake-case enum (`user_input|generate_text|generate_image|edit_image|generate_video|virtual_try_on|generate_audio`); reshape `WorkflowStep` to `{stepId,type,status,inputs,outputs,settings}`; replace `Workflow` `definition?` with `steps: WorkflowStep[]`, add `userId`; align `WorkflowExecution.status` to Angular `WorkflowRunStatusEnum`; type run-input `args` (not `inputs`).
Conflicts: every other WS reads these — land first.

### WS-A (BFF contract — independent of UI)
Files:
- `app/api/workflows/[id]/run/route.ts`
- `app/api/workflows/[id]/execute/route.ts`
- `app/api/workflows/[id]/executions/route.ts`
- `app/api/workflows/[id]/update/route.ts`
- `app/api/workflows/create/route.ts`
Scope: B2 fix (wrap body as `{args: {...inputs, workspace_id}}`); B3 fix (forward batch to `/batch-execute` with `{items:[{row_index,args}]}` shape, return `BatchExecutionResponseDto` unchanged); H10 (pass through `limit/page_token/status` query to `/executions`); fix `update`/`create` to forward `{name,description,steps}` (strip `definition` wrapper). `workspace_id` source: read from session/workspace cookie or accept from client header.
Conflicts: WS-C client hooks will need to match new request/response shapes — coordinate via WS-E types.

### WS-B (editor rebuild — largest body)
Files:
- `src/features/workflow-editor/components/workflow-editor.tsx`
- `src/features/workflow-editor/components/step-card.tsx`
- `src/features/workflow-editor/components/step-list.tsx`
- `src/features/workflow-editor/components/step-palette.tsx`
- `src/features/workflow-editor/hooks/use-workflow-editor.ts`
- (NEW) `src/features/workflow-editor/components/user-input-parameters.tsx`
- (NEW) `src/features/workflow-editor/components/outputs-panel.tsx`
- (NEW) `src/features/workflow-editor/components/add-step-modal.tsx`
- (NEW) `src/features/workflow-editor/step-configs.ts` (port `STEP_CONFIGS_MAP`)
Scope: H1 (User Input Parameters), H2 (Outputs panel 4-state), H3 (drag-reorder — native HTML5 DnD or `@dnd-kit`, already-installed deps rule applies), H4 (run-from-editor + status chip), H5 (per-type step config forms replacing `fixed/linked/mixed`), H6 (`prepareSteps` serializer), M3 (`router.replace` post-create).
Conflicts: none (disjoint from WS-A/C/D file-wise). Depends on WS-E.

### WS-C (list + detail + run modal + batch)
Files:
- `src/features/workflows/components/workflow-list.tsx`
- `src/features/workflows/components/workflow-detail.tsx`
- `src/features/workflows/components/run-workflow-modal.tsx`
- `src/features/workflows/hooks/use-workflows.ts`
- `src/features/workflows/hooks/use-workflow-executions.ts`
- `src/features/workflow-run/components/run-form.tsx`
- `src/features/workflow-run/components/batch-csv-upload.tsx`
- `src/features/workflow-run/components/execution-history.tsx`
- `src/features/workflow-run/components/media-output-resolver.tsx`
- `src/features/workflow-run/hooks/use-workflow-run.ts`
- `src/features/workflow-run/hooks/use-workflow-batch.ts`
- (NEW) `src/features/workflows/components/execution-details-modal.tsx` (port Angular `execution-details-modal` + `step-execution-details`)
Scope: H7 (image-typed run inputs via `ImageSelectorComponent` equivalent / source-asset upload), H8 (execution details modal), H9 (paginator + 500ms debounce), H10 client (cursor pagination, Load More), M4 (batch column mapping UI + results list), M5 (typed media resolver replacing heuristic), M6 (delete or repurpose dead `run-panel.tsx`).
Conflicts: depends on WS-E types + WS-A BFF shapes. Disjoint from WS-B/D file-wise.

### WS-D (workbench timeline + filter decision)
Files:
- `src/features/workbench/components/timeline-editor.tsx`
- `src/features/workbench/components/clip-block.tsx`
- `src/features/workbench/components/track.tsx`
- `src/features/workbench/components/workbench.tsx`
- (possibly) `src/features/workbench/components/filter-controls.tsx`
Scope: H11 (zoom slider, split, delete-selected, eye/lock toolbars, thumbnail strips, audio waveforms, selection ring), H12 (decide FilterControls keep-vs-remove; document if kept).
Conflicts: disjoint from all workflow work. Independent of WS-E.

---

## OLD GAP RE-VERIFICATION (post-wave)
| Prior gap (parity_routes/complex_admin) | Status now |
|---|---|
| `/workflows` no New button | ✅ FIXED (`workflow-list.tsx` L41, role-gated) |
| `/workflows` JSON dump on `/[id]` | ✅ FIXED (executions surface) |
| `/workflows/[id]/run` invented route | ✅ FIXED (redirects to `/[id]`) |
| Workflow role gate missing in middleware | ✅ FIXED (`middleware.ts` L33) |
| Editor Outputs/User-Input-Params/drag-reorder | ❌ STILL OPEN (H1/H2/H3) |
| Workbench Assets panel | ✅ FIXED (`assets-panel.tsx` integrated) |
| Workbench Properties panel + BETA | ✅ FIXED (`properties-panel.tsx` + Tooltip) |
| Workbench tool rail | ✅ FIXED (4 tools, audio/stories disabled) |
| Workbench timeline interactive UI (split/zoom/delete/waveform/thumbnail) | ❌ STILL OPEN (H11) |
| Backend batch-execute contract | ❌ NEWLY-IDENTIFIED BLOCKER (B3) — Next invented parallel semantics |
| WorkflowExecuteDto `args` vs `inputs` | ❌ NEWLY-IDENTIFIED BLOCKER (B2) |
| Step type discriminator mismatch | ❌ NEWLY-IDENTIFIED BLOCKER (B1) |

## CONFIDENCE
- P0 blockers (B1/B2/B3): **high** — verified against `openapi.json` schemas (`WorkflowCreateDto`, `WorkflowExecuteDto`, `BatchExecutionRequestDto`, per-step `inputs`/`settings`) AND Angular service code (`WorkflowService.executeWorkflow`/`batchExecuteWorkflow`/`WorkflowFormService`).
- H1–H13: **high** — read full Angular templates + Next components side-by-side.
- Route journey + role gating: **high** — read middleware + all 6 workflow page entries.
- Workbench clip-block/track internals: **medium** — `timeline-editor.tsx` read fully; `clip-block.tsx`/`track.tsx` not re-read this pass (last reviewed in `mem:migration_nextjs/parity_impl/workbench`). H11's missing affordances are confirmed at the `timeline-editor.tsx` prop API (no zoom/split/delete/toolbar/waveform wiring at composition layer).
- OpenAPI `/executions` response schema is `{}` (untyped) → M1 status enum mapping is inferred from Angular templates, not backend schema.