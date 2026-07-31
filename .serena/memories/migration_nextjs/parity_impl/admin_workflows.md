# Parity impl log: Admin/Workflows agent

Owner: Admin/Workflows agent. Written incrementally 2026-07-28. Angular = source of truth. `csp/frontend-next/**` is the port target.

## Task 1 — `/admin/users` ✅ DONE
Changed files:
- `src/features/admin/types.ts` — `AdminRole` now `"admin"|"user"|"creator"|"workflows"|string` (removed invented `"viewer"`); added `picture`, `createdAt`, `updatedAt`, `updated_at` to `AdminUser`.
- `src/features/admin/components/admin-controls.tsx` (NEW) — shared admin controls: `toQuery` (pure query serializer), `pageOffset` (pure pagination math), `MultiSelect`, `SortableHead` (aria-sort), `Paginator` (first/prev/next/last + page-size), `ColorPicker`, `SlideToggle`, `useDebouncedCallback`, `roleTone`.
- `src/features/admin/hooks/use-admin-users.ts` — `updateRoles(id, roles: AdminRole[])` now sends `{roles}` ARRAY (matches backend `UserUpdateRoleDto`); `refresh({email, includeDeleted, limit, offset})`; `buildUsersQuery` pure helper. CSRF cookie confirmed `csp_csrf` (lead already fixed — was NOT `csrf-token`).
- `src/features/admin/components/user-edit-dialog.tsx` — rebuilt on `Dialog` with `MultiSelect` (4 roles: user/creator/admin/workflows), validation "At least one role must be selected", live role chips.
- `src/features/admin/components/users-table.tsx` — rebuilt: email filter (debounced 500ms), include-deleted checkbox, paginator (10/25/100 + first/last), sortable headers (name/email/roles/createdAt/updatedAt, client-side, aria-sort), picture column (img or initial), role chips with tone mapping, delete uses `ConfirmDialog`, restore button for deleted rows, deleted rows opacity-50.
- `src/features/admin/index.ts` — exports new controls + `buildUsersQuery`, `USER_ROLES`.
- `src/features/admin/__tests__/users-query.test.ts` (NEW) — `bun:test` covering `toQuery`, `buildUsersQuery`, `pageOffset`.

Gaps closed: email filter, include-deleted, paginator, sortable headers, multi-role editing, role chips, avatar, delete confirmation.
API contract: PATCH `/api/admin/users/:id` body `{roles: string[]}` (proxy forwards to backend PUT `/users/:id` with `{roles}`). No API route touched.
CSRF: `csp_csrf` cookie + `x-csrf-token` header (unchanged, correct).
Controls worth promoting later to `src/components/ui/`: `Paginator`, `SortableHead`, `MultiSelect`, `SlideToggle`, `ColorPicker`, `toQuery`/`pageOffset` helpers.

## Task 2 — `/workflows` + route paradigm ✅ DONE
Changed files:
- `src/features/workflows/components/run-workflow-modal.tsx` (NEW) — `RunWorkflowModal` (Dialog with single/batch tabs) reuses `useWorkflowRun`/`useWorkflowBatch`/`RunForm`/`BatchCsvUpload` from `@/src/features/workflow-run` (preserved, not edited). Exports `inputFields(definition)` pure helper.
- `src/features/workflows/components/workflow-list.tsx` — rebuilt: card layout (name/desc/created/time-ago), role-gated "New" button, Edit+Delete hover actions, `ConfirmDialog` replaces `confirm()`, empty state, search input.
- `src/features/workflows/components/workflow-detail.tsx` — REBUILT (was JSON dump): executions surface matching Angular — back link, title/desc/meta, Run + Batch + Edit actions, status filter (ALL/SUCCEEDED/FAILED/ACTIVE), refresh button, execution cards with status badges, run modal.
- `app/(studio)/workflows/page.tsx` — upgraded `requireUser`→`requireRole(["workflows","admin"])`; passes `canEdit` to list.
- `app/(studio)/workflows/[id]/page.tsx` — upgraded role gate; passes `canEdit`; renders `WorkflowDetail` (now executions view).
- `app/(studio)/workflows/[id]/run/page.tsx` — invented route now `redirect()` to `/workflows/[id]`.
- `app/(studio)/workflows/new/page.tsx` + `[id]/edit/page.tsx` — role gate upgraded to match Angular.
- `src/features/workflows/index.ts` — exports `RunWorkflowModal`, `inputFields`, `formatTimeAgo`.

Gaps closed: New button (role-gated), card layout, ConfirmDialog delete, time-ago, route paradigm converged (executions = primary surface, run via modal). Invented `/run` route redirected. JSON dump replaced.
Backend auth NOT touched. `workflow-run/` feature preserved (imports only). `RunPanel` still exists in workflow-run but is no longer routed — could be removed later.
DEFERRED (editor internals — HIGH severity per gap analysis, NOT in task list): Outputs panel, User Input Parameters section, drag-reorder, step execution details. The editor at `/workflows/new` + `/[id]/edit` still has those gaps.

## Task 3 — Workbench ⏸️ PARTIAL (stopped mid-task)
Started but interrupted:
- `src/features/workbench/components/assets-panel.tsx` (NEW) — `AssetsPanel` (upload + asset grid + video/audio tabs + cloud/add + delete-on-hover) COMPILES but is **NOT yet imported/integrated** into `workbench.tsx`. Currently dead code.
- Properties panel NOT created. BETA label NOT added. `workbench.tsx` NOT modified.
- Timeline/trim logic + tests UNTOUCHED (preserved, still pass).

TODO to finish task 3: import `AssetsPanel` into `workbench.tsx`, add tool-selector state (gallery/audio/stories/edit), add `PropertiesPanel` (aspect ratio buttons + Lighting/Colors/Effects sliders), add BETA label with tooltip. `assets-panel.tsx` already exports `WorkbenchAsset` interface.

## Remaining tasks (NOT done)
3. Workbench — finish (integrate assets-panel, add properties panel + BETA label).
4. `/admin/media-gallery` — missing filters.
5. `/admin/tags` — color picker + inline edit.
6. Admin templates — create/edit dialog + thumbnail.
7. Admin dashboard — 2 charts + superAdmin gate.

## Controls worth promoting to `src/components/ui/` later
`Paginator`, `SortableHead`, `MultiSelect`, `SlideToggle`, `ColorPicker`, `toQuery`/`pageOffset` helpers (all in `src/features/admin/components/admin-controls.tsx`).

## Notes / deferred for lead
- Could not run `bun test` (no shell tool). Pure helpers verified by inspection.
- Workflow editor Outputs/User-Input-Params/drag-reorder gaps remain (not in task list).
- `RunPanel` in `workflow-run` no longer routed but left in place.
2. `/workflows` — New button + route paradigm convergence (executions primary, remove/redirect `/[id]/run` and JSON dump `/[id]`).
3. Workbench — Assets + Properties panels.
4. `/admin/media-gallery` — missing filters.
5. `/admin/tags` — color picker + inline edit.
6. Admin templates — create/edit dialog + thumbnail.
7. Admin dashboard — 2 charts + superAdmin gate.
