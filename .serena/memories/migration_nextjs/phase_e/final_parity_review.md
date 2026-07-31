# Phase E — FINAL read-only residual parity review

Date: 2026-07-29. Read-only. Re-audit of CURRENT code after every Phase E fix
landed. Supersedes nothing; consolidates the still-open items from
`mem:migration_nextjs/phase_e/{admin_audit,workflow_workbench_audit,content_audit}`
into one ship/sign-off list.

Scope: high/critical journeys only — gallery/templates/brand,
workflows/workbench, admin. Source of truth: Angular `frontend/**`. Port:
`frontend-next/**`. Backend: `backend/**` + `frontend-next/openapi.json`.

## Closed in Phase E (verified in current code, NOT a blocker)

Admin (admin_audit):
- B1 templates contract: GET/POST/PATCH/DELETE shape correct.
  `template-mappers.ts` emits nested `UpdateTemplateDto` (camelCase aliases,
  prune empty, `generationParameters` nested). POST `/from-media-item/{id}`
  is the ONLY backend create path (`media_templates_controller.py` L41-58
  + `UpdateTemplateDto` L23-36) — earlier audit verdict ("Angular posts
  nested body to `/media-templates`") was wrong; backend has no such route.
- B2 tags `workspace_id`, B3 AI routes `requireRole`, B5 AI inline toggle +
  provider filter, B6 feature-flag subnav gate, B9 dashboard KPI cards,
  B13 template-editor useCallback — all closed.
- B4 source-assets admin: platform-wide browse, scope/type filters, sort,
  paginator, Create Dialog, ConfirmDialog. Edit deliberately omitted
  (backend has no PUT/PATCH — `/api/source-assets/[id]` PATCH returns 501).

Workflows (workflow_workbench_audit):
- B1/B2/B3 contract (StepType snake, `WorkflowExecuteDto.args`,
  `BatchExecutionRequestDto.items[].args` + per-row `workspace_id`) — closed.
- H1 User Input Parameters, H2 Outputs panel (zero-state), H3 drag-reorder,
  H4 run-from-editor + status chip + `router.replace` after create,
  H5 per-type step config (`STEP_FIELDS`), H6 `prepareSteps` serializer — closed.
- H9 list paginator + 500ms debounce, H10 cursor pagination + server-side
  status filter + state→status normalize, M3 router.replace-after-create — closed.

Workbench (workflow_workbench_audit):
- H11 zoom slider + split + delete + eye/lock toolbars + thumbnail strip +
  audio waveform + selection ring — closed.
- H12 FilterControls deleted (Angular has no preview-side brightness/
  contrast/saturation controls) — closed.

Gallery/templates/brand (content_audit):
- B1 `/asset-detail/[id]` route exists, fetches real `/api/source_assets/{id}`.
- B2 pagination preserves filters (`useSearchParams`).
- B4 copy-to-workspace wired through real `copyMedia` mutation.
- B5 gallery detail actions wired (download/downloadZip/TagAssigner/Delete/
  remix/edit/start/end/VTO/omni/extend/concatenate) via plain `<Button>`s +
  sessionStorage `remixState` carry (NOT `<MediaLightbox>`).
- H1 brand-guidelines page (workspace fetch, palette swatches, ToV/visual
  style summaries, source-PDF links, Replace + Delete, role gating, polling).
- H2 fun-templates contract aligned to real `MediaTemplateResponse`.
- H3 fun-templates filters (`industry`/`mediaType`/`tags`/`name`/`model`).

## Remaining items ranked (≤10)

### P0 — block parity sign-off

**R1. Workflow image inputs: no ImageSelector/upload UI.**
- `run-workflow-modal.tsx` single-run renders a number `<Input>` asking
  for a raw `sourceAssetId`. `run-panel.tsx` (dead /run route) does the
  same plus batch coercion. NO Angular-parity `ImageSelectorComponent` +
  `SourceAssetService.uploadAsset` + `ReferenceImage` shape anywhere.
- Impact: image-typed workflow inputs are UX-broken. Backend image arg
  union accepts a bare int, so functionally the run can succeed, but
  users must know asset IDs by hand.
- Was: workflow_workbench_audit H7; partially mitigated by
  workflow_run_inputs_fix (single-run fieldset + RunPanel batch coercion).
- Backend-impossible? NO. Angular ships the picker.

**R2. Gallery Filters thinner than Angular.**
- `frontend-next/src/components/media/filters.tsx` ships: Search, From/To
  date, Media Type, comma-separated Tags. Deferred (file comment): Gen
  Model dropdown (no model enum in Next), Asset Type dropdown (`gallery/
  page.tsx` doesn't read `itemType`), "My tags" / "Only my media"
  checkboxes (session email not plumbed through `gallery-view.tsx`),
  searchable paginated tags MultiSelect + admin gear.
- Impact: 4 of 7 Angular filter affordances missing on the primary
  gallery browse journey. Asset-type filter blocks source-asset vs
  media-item filtering in mixed workspaces.
- Was: content_audit M1.
- Backend-impossible? NO. Mostly client plumbing + a shared tags dialog
  already exists in admin (`MultiSelect`).

### P1 — functional parity gap, runtime OK but journey diverges

**R3. Gallery detail does not mount `<MediaLightbox>`.**
- `gallery-detail.tsx` renders a static stage + plain `<Button>` action
  row. `src/components/studio/media-lightbox.tsx` is fully built
  (`ActionsToolbar` L226-313) but unused. Source-asset lightbox overlay
  (Angular `openSourceAssetInLightbox` L480-516 + html L646-659) NOT
  ported. Share / copy-link / see-more absent from gallery detail.
- Was: content_audit B5 (partial — actions wired, MediaLightbox not
  mounted by deliberate decision in gallery_actions_fix to avoid Menu
  nested-button styling).
- Backend-impossible? NO.

**R4. Template → /vto handoff not wired.**
- `templates_parity_fix` explicitly skipped VTO studio hydration: no
  `vto` mime/mediaType exists on backend (`MimeTypeEnum = image/png |
  video/mp4 | audio/mpeg`), so templates_parity keeps `/vto` branch for
  type completeness but it's never mime-reachable. Also `VideoStudio`/
  `AudioStudio` consume URL params via `initialState`, but `VtoStudio`
  accepts no props.
- Impact: VTO studio cannot be hydrated from any card click or gallery
  remix action (`gallery-actions.ts` does build the `sendToVto` intent
  with `modelImageAssetId` and writes `sessionStorage["remixState"]`,
  but `vto-studio.tsx` reader side only consumes from sessionStorage
  per remix_handoff_fix — so gallery→VTO works via sessionStorage,
  template→VTO does not).
- Was: content_audit B3 (partial).
- Backend-impossible? Partially — backend has no vto mediaType, so
  templates can never ROUTE to VTO by mime; but the studio side could
  still accept URL params for direct deep-linking. Half gap is
  intentional, half is missing plumbing.

**R5. ExecutionDetailDialog lacks fresh fetch + step-level media resolver.**
- `workflow-detail.tsx` opens `ExecutionDetailDialog` using only list-
  item data (no `GET /api/workflows/{id}/executions/{executionId}`).
  Angular `execution-details-modal` + `MediaResolutionService` +
  `StepExecutionDetails` resolve per-step media URLs typed by
  `stepTypeMap`. Next shows raw JSON `<details>` for outputs.
- Impact: users cannot preview step-produced media inside an execution
  modal. Status/duration/error still surface.
- Was: workflow_workbench_audit H8 (partial); workflow_history_fix
  deferred under "current-data only" scope constraint.
- Backend-impossible? NO. Backend exposes the GET endpoint.

**R6. RunWorkflowModal batch CSV does not coerce image columns.**
- `run-workflow-modal.tsx` L60 `<BatchCsvUpload fields={fields.map((f)
  => f.name)} />` — omits the `imageFields` prop. `RunPanel` (dead /run
  route) DOES pass it after `workflow_run_inputs_fix` follow-up.
- Impact: CSV image cells are uploaded as raw strings → backend 422 on
  `args.<image_field>` union. The 1-line fix is documented in the
  workflow_run_inputs_fix mem ("future 1-line add").
- Was: workflow_run_inputs_fix "Still out of scope" §3.
- Backend-impossible? NO. Coercion helper already exists.

### P2 — cosmetic / dead-code / documented divergence

**R7. `WorkflowModel` type drops fields; `WorkflowDetail` doesn't render owner.**
- `workflows/types.ts` `Workflow = {id,name,description?,definition?,
  status?,createdAt?,updatedAt?}`. Angular/backend `WorkflowModel` uses
  `steps` (not `definition`) + carries `userId`. Next `workflowModelToUi`
  remaps `steps → definition.steps` to preserve component API; `userId`
  dropped.
- Was: workflow_workbench_audit M2.
- Backend-impossible? NO. Type-widening only.

**R8. `use-workflow-run.ts` (dead /run route hook) state→status gap.**
- Poll `executions.some(({status}) => status === "running")` never
  matches backend `state` (ACTIVE/SUCCEEDED/FAILED); refresh on a
  list-shape guess (`data.items ?? data.executions`). Hook only
  consumed by dead `run-panel.tsx` (live workflow-detail uses
  `useWorkflowExecutions` which DOES normalize).
- Was: workflow_history_fix "Still open" §1; workflow_callers_fix §1.
- Backend-impossible? NO. Dead code; delete `run-panel.tsx` + route
  redirect, or apply `normalizeExecution`.

**R9. MediaOutputResolver fragility.**
- `media-output-resolver.tsx` `mediaIds()` regex (`/media|asset|item/i`
  + `/^[\w-]+$/`) misclassifies nested non-id strings; no step-type-
  aware resolver. Only reachable via dead `/workflows/[id]/run` route
  (`run-panel.tsx`).
- Was: workflow_workbench_audit M5.
- Backend-impossible? NO. Same dead-route cleanup as R8 moots this.

**R10. WorkflowDetail "Refreshed." toast drift.**
- `workflow-detail.tsx` L56 `onClick={() => { void refresh();
  show("Refreshed.", "neutral"); }}` toasts on every manual refresh;
  Angular has no toast on manual refresh (spinner swap only).
- Was: workflow_workbench_audit M7.
- Backend-impossible? NO. 1-line delete.

## Intentional enhancements / accepted divergences (NOT blockers)

- Plain-button gallery action row vs Angular `mat-menu` (gallery_actions_fix
  decision: clearer UX, same intents).
- Brand-guidelines as page route vs Angular dialog (workspace-switcher
  menu still links; redesign reviewed in H1 fix).
- Workbench per-track eye/lock buttons MADE FUNCTIONAL vs Angular
  placeholders (`matTooltip="coming soon!"`, `[disabled]="true"`) —
  intentional improvement documented in workbench_fix.
- Admin shell anatomy (global Sidebar + AdminSubnav pill row vs Angular
  right-side sidenav) — B8 accepted.
- Dashboard date-range uses native `<input type=date>` + fieldset
  grouping vs Angular calendar picker — B10 accepted approximation
  (dashboard_parity_fix).
- Fun-templates detail page route redesign vs Angular modal lightbox —
  intentional Next deviation.
- `SlideToggle` primitive pattern for AI admin inline enable —
  ai_admin_fix.
- Workspace switcher does not write `?workspaceId=` on change (matches
  Angular behaviour; canonical-param-only on read).

## Backend-impossible gaps (NOT blockers; require backend change first)

- `GET /api/media-templates/{id}` returns `MediaTemplateModel` with NO
  presigned URLs / NO enriched source assets (only `gcsUris` /
  `thumbnailUris` / `sourceAssets`). Next detail page honestly renders
  "No preview available". Fixed only by backend exposing presigned URLs
  on the detail endpoint (templates_parity_fix).
- `POST /api/media-templates` does not exist; only
  `/from-media-item/{id}` (body ignored). Next admin templates Create
  correctly requires `mediaItemId`.
- `/api/source_assets/{id}` has no PUT/PATCH (Next admin correctly
  omits edit UI; PATCH BFF returns 501).
- `MimeTypeEnum` has no `vto` value → templates can never route to VTO
  by mime. Studio-side URL hydration is the only path (R4).
- `/api/workflows/{id}/executions` OpenAPI response schema is `{}` —
  backend execution LIST shape (state/start_time/duration) inferred
  from Angular template only. Backend should publish the schema before
  final execution-state enum freeze.

## Confidence

- P0 (R1, R2): HIGH — read full Angular templates + Next components side
  by side; backend contracts verified via controllers/DTOs.
- P1 (R3-R6): HIGH — confirmed in current code + fix-mem caveats.
- P2 (R7-R10): HIGH — type/dead-code drift, low blast radius.
- Intentional/backend-impossible lists: HIGH — every entry verified
  against current backend code or fix-mem rationale.

## Ship recommendation

Parity CAN sign off for **workflows/workbench** (R1 is UX, not contract)
and **admin** (no P0; R-series items are P2 cosmetic). Parity CANNOT
sign off for **gallery** until R2 ships (Filters parity gap on the
primary browse journey) and arguably R3 (MediaLightbox not mounted is a
visible structural divergence even if actions are functionally wired).
Templates/brand pass except the VTO-studio half of R4 (which is itself
half backend-impossible).