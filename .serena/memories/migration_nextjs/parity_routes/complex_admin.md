# Parity findings: Workbench, Workflows, Admin

Scope owner: Complex/Admin Code Analyst (read-only). Evidence is code-only (no browser). Angular is source of truth. `frontend/src/app/**` vs `frontend-next/**`. Written 2026-07-28.

## Route / access parity table

| Angular route | Angular file | Next route | Next file | Status |
|---|---|---|---|---|
| `/workbench` | `frontend/src/app/workbench/workbench.component.{html,ts,scss}` + `workbench.service.ts` | `/workbench` | `frontend-next/app/(studio)/workbench/page.tsx` → `frontend-next/src/features/workbench/components/workbench.tsx` | partial — major layout/feature gap |
| `/workflows` (role gated WORKFLOWS+ADMIN) | `frontend/src/app/workflows/workflow-list/workflow-list.component.{html,ts}` | `/workflows` | `frontend-next/app/(studio)/workflows/page.tsx` → `frontend-next/src/features/workflows/components/workflow-list.tsx` | partial — **no "New" create button in Next** |
| `/workflows/new` | `workflow-editor.component.{html,ts}` (+`workflow-form.service.ts`, `add-step-modal`, `run-workflow-modal`, `step-components/`) | `/workflows/new` | `frontend-next/app/(studio)/workflows/new/page.tsx` → `frontend-next/src/features/workflow-editor/components/workflow-editor.tsx` | partial — outputs panel, user-input params, run-from-editor missing |
| `/workflows/edit/:workflowId` | same editor | `/workflows/[id]/edit` | `frontend-next/app/(studio)/workflows/[id]/edit/page.tsx` | route shape change + same editor gaps |
| `/workflows/:id/executions` (ExecutionHistory + batch + details modals) | `frontend/src/app/workflows/execution-history/execution-history.component.{html,ts}` + `batch-execution-modal/`, `execution-details-modal/`, `workflow-execution-polling.service.ts` | split: `/workflows/[id]` (WorkflowDetail) + `/workflows/[id]/run` (RunPanel) | `frontend-next/app/(studio)/workflows/[id]/page.tsx` and `.../[id]/run/page.tsx` | **route paradigm mismatch** |
| — (no Angular equivalent; run is a modal) | `RunWorkflowModalComponent` | `/workflows/[id]/run` | `frontend-next/src/features/workflow-run/components/run-panel.tsx` (+`run-form.tsx`, `batch-csv-upload.tsx`, `execution-history.tsx`, `media-output-resolver.tsx`) | Next extra route |
| `/admin` → redirect `/admin/dashboard` | `admin-routing.module.ts` + `admin-home/admin-home.component.{html,ts,scss}` | `/admin` | `frontend-next/app/(admin)/admin/page.tsx` | partial — charts/role-gate gap |
| `/admin/users` | `users-management/{users-management.component,user-form.component}.{html,ts}` + `user.service.ts` | `/admin/users` | `frontend-next/app/(admin)/admin/users/page.tsx` → `users-table.tsx`, `user-edit-dialog.tsx` | partial — multi-role + filters gap |
| `/admin/source-assets` | `source-assets-management/source-assets-management.component.{html,ts}` + `source-asset-form/`, `source-asset-upload-form/`, `source-assets.service.ts` | `/admin/source-assets` | `frontend-next/app/(admin)/admin/source-assets/page.tsx` → `frontend-next/src/features/source-assets` `SourceAssetAdmin` | **Next component body not inspected** |
| `/admin/media-templates` | `media-templates-management/media-templates-management.component.{html,ts}` + `media-template-form/`, `media-templates.service.ts` | `/admin/templates` | `frontend-next/app/(admin)/admin/templates/page.tsx` → `template-editor.tsx` | **route renamed** + form layout mismatch |
| `/admin/media-gallery` | `media-gallery-management.component.{html,ts}` | `/admin/media-gallery` | `frontend-next/app/(admin)/admin/media-gallery/page.tsx` → `media-gallery-admin.tsx` | partial — most filters missing |
| `/admin/tags` | `tags-management.component.{html,ts}` | `/admin/tags` | `frontend-next/app/(admin)/admin/tags/page.tsx` → `tag-manager.tsx` | partial — color picker/inline edit missing |
| `/admin/ai-providers` (feature-flag `aiProviderRegistryAdmin`) | `ai-providers-management/{ai-providers-management.component,ai-provider-form-dialog.component}.{html,ts}` | `/admin/ai-providers` | `frontend-next/app/(admin)/admin/ai-providers/page.tsx` → `ai-providers-admin.tsx` | close — inline slide-toggle vs dialog |
| `/admin/ai-models` (feature-flag `aiProviderRegistryAdmin`) | `ai-models-management/{ai-models-management.component,ai-model-form-dialog.component}.{html,ts}` | `/admin/ai-models` | `frontend-next/app/(admin)/admin/ai-models/page.tsx` → `ai-models-admin.tsx` | close — provider filter + inline toggle missing |

### Omissions (in Next, present in Angular)
1. `/workflows` Next has **no "New workflow" create button** — Angular gates it on `authService.isUserAdmin() || authService.isUserWorkflows()`. Next's `WorkflowList` only renders Search + Delete. **Create journey blocked.**
2. `/workflows/new` and `/workflows/[id]/edit` Next editor: **no Outputs panel** (right side of Angular editor with per-step execution state), **no User Input Parameters section** (define workflow inputs), no Run button inside editor, no status chip, no drag-handle visual, no `RunWorkflowModalComponent` equivalent.
3. `/admin` Next dashboard: missing **Media per Workspace** chart, **Monthly Active Users (Evolution)** chart, **superAdmin-only gate** (Angular shows "Restricted View" for non-super-admin; Next shows dashboard to every admin), no `<studio-date-range-filter>` equivalent (only two date inputs).
4. `/admin/users` Next: no avatar/picture column, no email filter, no `include-deleted` checkbox, no paginator, no sort headers, no role chips. **Single-role select vs Angular's multi-role `<mat-select multiple>`.**
5. `/admin/media-gallery` Next: only one free-text filter; Angular has 7-column filter grid (search, user email, status, type, model, tags multi-select, date range) + include-deleted.
6. `/admin/templates` Next: inline form (no dialog), no thumbnail column, no mimeType chip, no brand column, no filter, no paginator.
7. `/admin/tags` Next: no color picker column, no inline edit row, no paginator; Next requires manual `workspace_id` entry and exposes raw `bulk-assign` form Angular does not show on this page.
8. `/workbench` Next: missing Assets panel (gallery/audio/stories tabs + cloud selector + asset grid), Properties panel (`edit` mode: aspect ratio + Lighting + Colors + Effects sliders), BETA label with tooltip, video/audio tab toggle, upload button. Next only ships preview + transport + filter + timeline + render.
9. `/admin/ai-models` Next: no provider filter dropdown at top of page; no inline `<mat-slide-toggle>` for enabled (Next shows "Yes/No" text and requires opening dialog).
10. Admin shell: Next sidebar shows AI Providers/Models unconditionally; Angular gates with `featureFlags.isEnabled('aiProviderRegistryAdmin')`.

### Extras (in Next, not in Angular)
1. `/workflows/[id]/run` standalone route. Angular runs via modal (`RunWorkflowModalComponent`) triggered from editor or history.
2. `/workflows/[id]` (WorkflowDetail) showing raw `JSON.stringify(workflow.definition)` — Angular has no definition-dump view; Angular's per-workflow landing page is ExecutionHistory.
3. `/admin/templates` page route name itself (Angular is `media-templates`).
4. `MediaOutputResolver` rendered inline on run page; Angular resolves media inside the execution details modal.

## Role / access blockers (dedicated)

### Angular (source of truth)
- `AdminAuthGuard` (`admin-auth.guard.ts`): browser-side only; checks `authService.isLoggedIn()` then `userService.getUserDetails()` from **`localStorage USER_DETAILS`**, then `authService.isUserAdmin()`. On failure: error snackbar "Access Denied: Your email (${userEmail}) is not authorized or login session expired.", **forced logout**, redirect to `/login`.
- `AuthService.isUserAdmin()` (`common/services/auth.service.ts` L340): reads `userService.getUserDetails()?.roles` and checks `.includes(UserRolesEnum.ADMIN)`. Same signal gates dashboard superAdmin view (`isSuperAdmin$ = of(authService.isUserAdmin())`).
- `/workflows` route uses `data: { requiredRoles: [UserRolesEnum.WORKFLOWS, UserRolesEnum.ADMIN] }` and `canActivate: [AuthGuardService]`. Per-button UI gates additionally call `authService.isUserWorkflows()`.
- Role values stored in localStorage come from backend `/users/me` sync.

### Next
- Middleware `frontend-next/src/middleware.ts` matches everything except `api|_next|login|static|...`. Reads `SESSION_COOKIE` (`csp_session`), calls `verifySession`, redirects to `/login?next=...` if absent. For `/admin*` paths, redirects to `/` when `!session.roles.includes("admin")`. Note: matcher runs for all `(studio)` routes too — session is required for every studio page.
- Layout `frontend-next/app/(admin)/admin/layout.tsx` re-checks via `requireRole(["admin"])`. Subroutes `tags/templates/media-gallery/source-assets` re-call `requireRole(["admin"])`; `users/ai-models/ai-providers` do **not** — they rely on layout (acceptable).
- `(studio)/layout.tsx` adds an "Admin" sidebar link only when `session.roles.includes("admin")`. Workflow routes use only `requireUser()` (no role gate vs Angular's `WORKFLOWS`/`ADMIN` data check) — so in Next **any logged-in user can reach `/workflows`**, not just WORKFLOWS/ADMIN roles. **Behavior mismatch.**
- Session shape (`src/lib/auth/session.ts`): `Role = "admin" | "user" | "creator" | "workflows"`. **AdminUser types in `features/admin/types.ts` use `"admin" | "creator" | "viewer"`** — "viewer" vs "user" mismatch. **Not verified** how backend maps roles into the signed cookie; `verify.ts` only verifies the Google credential, doesn't show role source. **Role value flow into Next session not confirmed end-to-end.**

### Blockers / risks
1. **CSRF cookie name mismatch**: `use-admin-users.ts` and `user-edit-dialog.tsx` read `document.cookie.split("; ").find((item) => item.startsWith("csrf-token="))`, but `session.ts` defines `CSRF_COOKIE = "csp_csrf"`. Admin user mutations (PATCH/DELETE) will fail CSRF if matched strictly. `use-ai-models.ts`/`use-ai-providers.ts` use `getCsrf()` via `/api/auth/csrf` (correct). **Hard blocker for users admin mutations.**
2. **Workflow create button missing in Next** (`/workflows` page) — primary journey blocked even after auth works.
3. **Workflow role gate missing in Next**: middleware only blocks `/admin*`. `/workflows*` is open to any authenticated user. Backend may still authorize, but UI parity says restrict.
4. **Dashboard superAdmin gate missing in Next**: every admin sees platform-wide stats; Angular restricts to superAdmin (org admins see "Restricted View").
5. **Role values flow not verified end-to-end** — can't confirm `session.roles.includes("admin")` will be true for an Angular-admin user without seeing backend `/api/auth/...` and `/api/users/me` population. **Must verify before sign-off.**

## Per-route deltas (classification + severity)

### `/workbench` — severity HIGH
- Layout mismatch: missing Assets panel (gallery/audio/stories tabs + cloud selector + asset grid + add-from-cloud + delete-on-hover + video/audio/drive/upload tab strip), missing Properties panel (`edit` mode: aspect ratio 16:9/9:16/1:1/4:3 buttons + Lighting Exposure/Contrast/Highlights/Shadows/Whites/Blacks + Colors Temp/Tint/Vibrance/Saturation + Effects Texture/Clarity sliders via `studio-slider`).
- Missing: BETA label with tooltip "This is currently under development…".
- Missing: `activeToolButton` state machine (gallery/audio/stories/edit/agent) — Next has no tool selector.
- Missing: tab toggle `activeTab` ('video'|'audio') asset filter.
- Behavior mismatch: Angular uses `studio-button` with shape circle/pill + custom SVG icons (`video-clap-icon`, `sound-sensing-icon`, `drive-icon`, `upload-icon`); Next has none.
- Logic to preserve (Next): `useTimelineState`, `usePlayback`, `time.ts`, `timeline.ts`, `trim.ts`, `totalDuration`, `RenderPanel`, `PreviewCanvas`, `TimelineEditor`, `TransportControls`. These are valid working modules — presentation rebuild must keep their APIs.
- Shared prerequisite: `studio-slider` primitive, icon registry equivalents, `<studio-button shape>` variants — all shared UI.

### `/workflows` (list) — severity HIGH (blocker for create)
- Missing: "New" `studio-button variant="cta"` gated on `isUserAdmin() || isUserWorkflows()`.
- Layout mismatch: Angular renders **cards** with name/description/created/time-ago (`formatTimeAgo`) + hover actions (edit + delete with tooltips). Next renders a Table with Name/Description/Status/Updated/Actions columns. Status column doesn't exist in Angular list view.
- Behavior mismatch: delete uses Angular `ConfirmationDialogComponent` (350px dialog with title+message); Next uses `confirm("Delete this workflow?")`. Card click navigates to `/workflows/:id/executions` in Angular; Next links the workflow name to `/workflows/[id]`.
- Missing: `mat-paginator` with pageSizeOptions [5,10,25,100] and `showFirstLastButtons`. Next has no paginator.
- Behavior mismatch: Angular filter is `studio-search-filter` with icon + expandable; Next is plain Input + Search button.
- Logic to preserve (Next): `useWorkflows` hook, `remove`, `search`.
- Shared prerequisite: ConfirmationDialog, Paginator, Card primitives, timeAgo formatter.

### `/workflows/new` and `/workflows/[id]/edit` — severity HIGH
- Route shape change: `/workflows/edit/:workflowId` → `/workflows/[id]/edit` (param rename). Update links.
- Missing: header with Back button + editable title/description inline + status chip (Run mode shows `currentExecutionState`) + Run + Save primary actions.
- Missing: User Input Parameters section (FormArray of `{name, type: text|image}` definitions — these power the run form schema).
- Missing: Outputs panel (right 1/3) with four states: zero-state, running, completed, per-step outputs (`app-step-execution-details` resolver).
- Missing: step drag-and-drop reorder (`cdkDropList`) with `[cdkDragDisabled]` in read-only mode.
- Missing: `AddStepModalComponent` (Angular opens a modal to add steps); Next has inline `StepPalette`.
- Missing: `RunWorkflowModalComponent` (run-from-editor with input params); Next separates run to `/workflows/[id]/run`.
- Logic to preserve (Next): `useWorkflowEditor`, `StepPalette`, `StepList`, validation pipeline.
- Shared prerequisite: split-pane layout, status chip, drag-handle, modal primitive.

### `/workflows/[id]` (WorkflowDetail) + `/workflows/[id]/run` — severity MEDIUM (route paradigm mismatch)
- Angular has **no detail page**; the per-workflow landing is `/workflows/:id/executions` (ExecutionHistory).
- Next `/workflows/[id]` dumps `JSON.stringify(workflow.definition)` — no Angular equivalent.
- Next `/workflows/[id]/run` introduces a standalone page; Angular runs via modal.
- Angular ExecutionHistory features missing in Next: status filter dropdown (ALL/SUCCEEDED/FAILED/ACTIVE), refresh button, Batch Execution modal (`BatchExecutionModalComponent`), Execution Details modal (`ExecutionDetailsModalComponent`), polling service (`WorkflowExecutionPollingService`), paginator with cursor (`nextPageToken`).
- Logic to preserve (Next): `useWorkflowRun`, `useWorkflowBatch`, `useWorkflowExecutions`, `RunForm`, `BatchCsvUpload`, `ExecutionHistory`, `MediaOutputResolver`, `inputFields()` schema extractor.
- Decision needed: **align routes to Angular (merge detail+run back into executions list with modals)** or accept new Next route shape and update Angular links/expectations. Flag for lead.

### `/admin` (dashboard) — severity MEDIUM
- Layout mismatch: Angular 8-card overview (Total Users, Workspaces, Images Gen, Videos Gen, Audios Gen, AI Media Total, Uploaded, Overall Total) with icon+number+label+tooltip; Next renders arbitrary `data.overview` entries as text-only cards.
- Missing charts: **Media per Workspace** (stackled bar), **Monthly Active Users Evolution** (line+area with gradient).
- Missing: `<studio-date-range-filter size="small">` (Next uses two date inputs).
- Missing: superAdmin-only content gate with "Restricted View" fallback (`*ngIf="isSuperAdmin$ | async; else orgAdminView"`).
- Behavior mismatch: Next "Clean stuck jobs" button POSTs to `/api/admin/dashboard` — Angular media-gallery has the cleanup action, not dashboard. **Confirm intended location.**
- Logic to preserve (Next): `DashboardFilters`, `BarChart`, `DonutChart`, `LineChart` (chart primitives live in `frontend-next/src/components/charts`). The Angular charts are D3-implemented in `admin-home.component.ts`; can map to Next chart primitives or rebuild with same data shape.
- Shared prerequisite: date-range filter primitive, role-gated section helper, KPI card primitive.

### `/admin/users` — severity HIGH
- Missing: picture/avatar column with `user.picture || default-avatar.png`.
- Missing: filter input (debounced 500ms), `include-deleted` checkbox.
- Missing: paginator with `[10,25,100]` + `showFirstLastButtons`.
- Missing: sort headers (`mat-sort-header`) on name/email/roles/createdAt/updatedAt.
- Missing: role chips with `getRoleChipClass` color mapping.
- Behavior mismatch: **single-role select** (viewer/creator/admin) in `user-edit-dialog.tsx` vs Angular **multi-role** `<mat-select multiple>` with validation "At least one role must be selected."
- Missing: delete confirmation + restore; Next has buttons but no confirm dialog.
- Logic to preserve (Next): `useAdminUsers` hook — **but fix CSRF cookie name first**.
- Shared prerequisite: multi-select, role chip, paginator, confirm dialog, avatar.

### `/admin/source-assets` — severity MEDIUM-HIGH (**Next body not inspected**)
- Angular: Create Asset button (opens form), Filter by Scope + Filter by Type, Clear + Search actions, table thumbnail/originalFilename/assetType chip/createdAt/actions(edit+delete), sort, paginator with `[10,25,100]` + `showFirstLastButtons`.
- Next: only verified heading wrapper "Source assets". `SourceAssetAdmin` body in `frontend-next/src/features/source-assets` **not read**.
- Logic to preserve (Next): unverified — read `frontend-next/src/features/source-assets/**` before edit.

### `/admin/templates` (Angular `media-templates`) — severity HIGH
- **Route renamed**: `/admin/media-templates` → `/admin/templates`. Either keep Next name and document, or rename Next route.
- Missing: thumbnail column (presigned URLs), mimeType chip (color by video/mp4 vs image/png), brand column, description column with truncate + tooltip.
- Missing: filter input, paginator, sort headers.
- Behavior mismatch: Next uses **inline form** + table on same page; Angular opens a dialog (`media-template-form/`) from a Create button.
- Missing: Create Template button + dialog flow.
- Logic to preserve (Next): `TemplateEditor` fetch/save logic. Verify JSON.parse(options) doesn't crash on invalid input (current Next impl will throw).
- Shared prerequisite: form Dialog, thumbnail cell, paginator.

### `/admin/media-gallery` — severity HIGH
- Missing: Cleanup Stuck Jobs button has tooltip "Clear jobs in processing for more than 1 hour" (Next button lacks tooltip).
- Missing filters: user email, status (with options), type (All/AI Generated/User Upload), model (options), tags (multi-select), date range (`mat-date-range-input`), include-deleted checkbox.
- Missing columns: thumbnail (audio icon + image fallback), workspace name, user avatar (with email tooltip), model chips (AI Generated vs User Upload with color), status chips (processing/completed/failed with color + spinner + icon).
- Missing: paginator, sort, row hover/cursor, deleted row opacity-50.
- Missing: open-in-new link to `/asset-detail/:id` or `/gallery/:id`.
- Logic to preserve (Next): `MediaGalleryAdmin` action dispatch (cleanup/delete/restore). Note Next hardcodes `offset=page*25&limit=25` — verify Angular uses cursor or offset.
- Shared prerequisite: date range picker, multi-select, status chip, paginator.

### `/admin/tags` — severity MEDIUM-HIGH
- Missing: color picker column (Angular shows color swatch; in edit mode shows `<input type="color">`).
- Missing: inline edit row (edit/save/cancel icon buttons per row); Next uses `prompt()` for rename.
- Missing: paginator.
- Behavior mismatch: Next create form requires manual `workspace_id` number input; Angular uses current workspace implicitly.
- Behavior mismatch: Next exposes a raw "Assign tags" form (comma-separated media IDs + tag IDs); Angular does not show bulk-assign on this page.
- Logic to preserve (Next): `TagManager` load/create/delete. **`JSON.parse` in template-editor is a footgun — apply same audit to TagManager if form expands.**
- Shared prerequisite: color picker, inline-edit row pattern, paginator.

### `/admin/ai-providers` — severity LOW-MEDIUM
- Close overall. Behavior parity mostly intact.
- Behavior mismatch: Angular inline `<mat-slide-toggle>` for `enabled` (mutates immediately); Next shows "Yes/No" text and requires opening dialog to toggle.
- Missing: table-level "Test" action exists in both — Next does have it. ✓
- Logic to preserve (Next): `useAiProviders` hook (`create/update/remove/test`).
- Shared primitive delta: **slide toggle primitive** for inline enable.

### `/admin/ai-models` — severity LOW-MEDIUM
- Missing: provider filter dropdown at top of page (Angular `mat-select` filters by `providerId`).
- Behavior mismatch: same inline slide-toggle gap as providers.
- Logic to preserve (Next): `useAiModels` hook.
- Shared primitive delta: slide toggle, filter select.

### Admin shell (`/admin` layout) — severity MEDIUM
- Layout mismatch: Angular `mat-sidenav` with `position="end"` (= **right side** in LTR), 250px width, 10rem right padding on container. Next uses left sidebar `md:grid-cols-[15rem_1fr]`. **Side swapped.**
- Missing: nav icons (`dashboard`, `people`, `perm_media`, `inventory_2`, `photo_library`, `label`, `hub`, `smart_toy`).
- Missing: active link gradient (`linear-gradient(to right, #3b82f6, #8b5cf6, #f87171)` on `.active-link`).
- Missing: feature-flag gate `aiProviderRegistryAdmin` on AI Providers + AI Models nav items.
- Behavior mismatch: Angular `mat-sidenav-content` has `!m-0 !p-10`; Next `main` has `p-6 md:p-8`.
- Logic to preserve (Next): `requireRole(["admin"])` check in layout is correct. Keep.
- Shared prerequisite: Sidebar primitive already exists for `(studio)` — admin should adopt a shared admin-sidebar variant or compose with feature-flag + icon support.

## Next presentation to rebuild vs Next logic to preserve

**Presentation to rebuild** (visual/UX only):
- `(admin)/admin/layout.tsx` — adopt Angular right-side sidenav anatomy + icons + active gradient + feature-flag gating. Keep `requireRole` call.
- `(admin)/admin/page.tsx` — dashboard composition: 8-card KPI grid, 4-chart layout (add workspace + monthly users), superAdmin gate with Restricted View fallback. Keep `DashboardFilters` invocation pattern.
- `(admin)/admin/users/page.tsx` + `users-table.tsx` + `user-edit-dialog.tsx` — table anatomy, multi-role select, filter, include-deleted, paginator, avatar, role chips.
- `(admin)/admin/templates/page.tsx` + `template-editor.tsx` — dialog form, table columns, paginator. **Decide route name first.**
- `(admin)/admin/media-gallery/page.tsx` + `media-gallery-admin.tsx` — 7-filter grid, table columns, status chips.
- `(admin)/admin/tags/page.tsx` + `tag-manager.tsx` — color picker, inline edit, paginator.
- `(admin)/admin/source-assets/page.tsx` + `SourceAssetAdmin` — **read body first**, then align filters/sort/paginator.
- `(admin)/admin/ai-models/page.tsx` + `ai-models-admin.tsx` — add provider filter, inline slide-toggle.
- `(admin)/admin/ai-providers/page.tsx` + `ai-providers-admin.tsx` — inline slide-toggle.
- `(studio)/workflows/page.tsx` + `workflow-list.tsx` — card layout, create button (role-gated), paginator, confirm dialog, time-ago.
- `(studio)/workflows/new/page.tsx`, `[id]/edit/page.tsx` + `workflow-editor.tsx` — header (back/title/status/run/save), user-input params, outputs panel, drag-reorder.
- `(studio)/workflows/[id]/page.tsx` + `workflow-detail.tsx` — **decide route merge with executions first**.
- `(studio)/workflows/[id]/run/page.tsx` + `run-panel.tsx` — **decide route paradigm first**.
- `(studio)/workbench/page.tsx` + `workbench.tsx` — assets panel, properties panel, BETA label, tool selector, tab strip.

**Logic to preserve** (do NOT rewrite for parity):
- `frontend-next/src/middleware.ts` — auth+role redirect logic (correct as-is; may extend to gate `/workflows*` by role).
- `frontend-next/src/lib/auth/{session,server,verify,gis}.ts` — session/JWT/verification. **Patch role-source path once verified, but core crypto logic stays.**
- `frontend-next/src/features/admin/hooks/{use-admin-users,use-ai-models,use-ai-providers}.ts` — **fix CSRF cookie name in `use-admin-users.ts`** (cookie is `csp_csrf` not `csrf-token`), keep API contracts.
- `frontend-next/src/features/workflows/hooks/*` (use-workflows, use-workflow-executions) — list/detail data hooks.
- `frontend-next/src/features/workflow-editor/hooks/use-workflow-editor.ts` — draft/validation/save logic.
- `frontend-next/src/features/workflow-run/hooks/{use-workflow-run,use-workflow-batch}.ts` — execution + batch submission.
- `frontend-next/src/features/workbench/{time,timeline,trim}.ts` + `hooks/{use-playback,use-timeline-state}.ts` + `components/{preview-canvas,timeline-editor,transport-controls,render-panel,clip-block,track,filter-controls}.tsx` — timeline math and playback logic is sound.
- `frontend-next/src/components/charts/{bar-chart,donut-chart,line-chart}.tsx` — chart primitives; reuse for dashboard.
- `frontend-next/app/api/admin/**` and `frontend-next/app/api/workflows/**` — server routes untouched.

## Shared primitive API deltas

| Primitive | Current state | Minimum API delta needed |
|---|---|---|
| Table (`components/ui/table.tsx`) | Table/Header/Row/Head/Cell, `stickyHeader` only | Add `<TableSortHead>` (controlled sort state + direction indicator), `<Paginator>` (page size options + showFirstLastButtons + cursor OR offset mode), `<NoDataRow>`, optional row `hover`/`cursor`/`deleted` classes |
| Dialog (`components/ui/dialog.tsx`) | Modal `<dialog>` with title/size | Add `actions` slot + `align="end"` for action buttons (Angular pattern), confirm variant |
| Field (`components/ui/field.tsx`) | Label + error + hint | Accept `required`, integrate with multi-select/chip components |
| Confirm dialog | **Missing** — Next uses `confirm()`/`prompt()` | New `<ConfirmDialog title message onConfirm onCancel>` — replaces ad-hoc browser dialogs for delete flows |
| MultiSelect / chips | **Missing** | New `<MultiSelect options value onChange>` (mat-select multiple equivalent) — needed for roles, tags filter |
| Status chip / Badge | Badge exists, unused in admin | Status→color map helper (running/completed/failed + spinner + icon) |
| Slide toggle | **Missing** | New `<Toggle checked onChange>` for inline enable in tables |
| Date range picker | **Missing** | New `<DateRangeFilter>` (start/end + clear + presets) — Angular uses `mat-date-range-input` |
| Color picker | **Missing** | Native `<input type="color">` wrapper with swatch preview |
| Avatar | **Missing** | `<Avatar src fallback>` for user/media-gallery rows |
| KPI card | **Missing** | `<KpiCard icon value label tooltip>` for dashboard |
| Icon set | Custom SVG inline in sidebar | Shared icon registry (Angular uses Material Icons + custom SVGs `video-clap-icon` etc.) |

## What was NOT verified
- `frontend-next/src/features/source-assets/**` body (only heading wrapper read).
- `frontend-next/src/features/workflows/hooks/*`, `workflow-editor/hooks/*`, `workflow-run/hooks/*` internals.
- `frontend-next/src/features/workflow-run/components/{run-form,batch-csv-upload,execution-history,media-output-resolver}.tsx` internals.
- `frontend-next/src/features/workflow-editor/components/{step-card,step-list,step-palette}.tsx` internals.
- `frontend-next/src/features/workbench/components/*` internals (only `workbench.tsx` composition read).
- Angular services: `workflows/workflow.service.ts`, `workflows/workflow-form.service.ts`, `workflows/shared/*`, `workbench.service.ts`, `admin-dashboard.service.ts`, `users-management/user.service.ts`, `source-assets-management/source-assets.service.ts`, `media-templates-management/media-templates.service.ts`, `media-gallery-management.component.ts` body, `tags-management.component.ts` body, `ai-models-management/ai-models-management.component.ts` body, `ai-providers-management/ai-providers-management.component.ts` body, `users-management/users-management.component.ts` body (only ngOnInit slice read), `workflow-editor.component.ts` body (only first 150 lines read), `workbench.component.ts` body (only first 120 lines read), `workbench.component.html` after line 350.
- Angular modals: `add-step-modal`, `run-workflow-modal`, `batch-execution-modal`, `execution-details-modal`, `media-template-form`, `source-asset-form`, `source-asset-upload-form`, `user-form.component.ts` body.
- Next `app/api/admin/**` and `app/api/workflows/**` route handlers — only inferred from client calls.
- Role-value flow from backend into Next `session.roles` — `verify.ts` only verifies Google credential; **role population point not seen**.
- Material Icon SVG names → Next SVG mapping for admin nav.
- Backend pagination contract (cursor vs offset) for users/source-assets/media-gallery/tags/templates.
- Feature-flag source for `aiProviderRegistryAdmin` in Next (no Next feature-flag system observed).

## Confidence
- Route/access parity table: **high** (read both routers fully).
- Per-route layout deltas: **medium-high** for routes where I read both Angular template + Next component (`/workbench`, `/workflows` list, `/admin` dashboard, `/admin/users`, `/admin/media-gallery`, `/admin/templates`, `/admin/tags`, `/admin/ai-providers`, `/admin/ai-models`, admin shell). **Low** for `/admin/source-assets` (Next body unread) and for editor/run internals.
- Role/access blockers: **high** on Angular side (guard + AuthService read fully), **medium** on Next side (middleware + layout + session.ts read; backend role population not seen). CSRF cookie mismatch is **confirmed** by file inspection.
- Shared primitive deltas: **high** (read all `components/ui/*.tsx` listed).
