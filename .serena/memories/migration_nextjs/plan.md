# Migration plan
Detailed design mapping: `mem:migration_nextjs/design_mapping`. Detailed lane ownership/waves: `mem:migration_nextjs/parallel_execution`.
## Design contract gate
Before feature migration, turn `frontend-next/tridorian-agent-theme-v3.json` into semantic CSS variables and Tailwind theme bindings. Treat `frontend-next/tridorian-design-system.html` as visual acceptance reference and `frontend-next/tridorian-agent-instructions.md` as review checklist. Every UI PR must verify light/dark contrast, 44px targets, keyboard/focus behavior, mobile no-overflow, reduced motion, semantic colors, sparse green, single ambient gradient, and one dominant action.

## Parallel execution model
- Use one integration owner and independent feature workstreams. Each workstream gets isolated git worktree/branch only when execution starts and user approves branch creation; no shared-file concurrent edits.
- Integration lane owns shared files only: Next config, root layouts, token generator/output, global CSS, API client core, auth/session, workspace provider, shared primitives, CI, Docker, Terraform. Feature lanes may consume these but not edit them.
- Feature lanes own disjoint directories under `frontend-next/src/features/<feature>` and corresponding route folders/tests. Contract changes go through integration lane first.
- Merge order follows dependency waves. Within each wave, lanes run concurrently; next wave starts after shared contracts and acceptance checks pass.
- Every lane starts from same integration SHA, rebases before handoff, runs feature tests/typecheck/lint/build, and supplies parity evidence. Integration owner merges serially to catch cross-feature conflicts.
- Avoid parallel work on coupled editors: image shared media primitives before video/VTO/upscale; workflow schema before workflow editor; timeline math before workbench UI.

## Phase 0 — contracts and acceptance
1. Freeze route/feature matrix from `mem:migration_nextjs/feature_catalog`; capture parity screenshots and happy/error/permission journeys.
2. Export FastAPI OpenAPI; generate TS types/client in CI. Add contract checks for auth headers, casing, enums, pagination, binary responses, signed URLs.
3. Decide UI primitive set and Cloud Run vs static hosting. Required default: Cloud Run.
4. Define feature flags/traffic split and rollback to Angular.
## Phase 1 — foundation
Auth prerequisite: remove Firebase/AngularFire frontend coupling using `mem:migration_nextjs/gcp_auth`. Use GIS/FedCM + secure server session; no raw token in localStorage. Backend remains FastAPI authorization source.
1. Scaffold `nextjs/` strict TS App Router, Tailwind, lint/test/build, Docker target; Apache license automation.
2. Build route groups/layouts, responsive shell, header/footer, error/loading/not-found boundaries, toast/dialog primitives.
3. Implement secure session bridge: login, ID-token verification/session cookie, logout, `/users/me`, role helpers; protect studio/admin/workflow layouts. Security test expiry, tamper, CSRF/session fixation, domain restriction.
4. Build typed FastAPI client, normalized errors, workspace provider and `workspaceId` URL behavior.
5. Shared primitives: media card/lightbox/player, selector, upload/dropzone, confirm dialog, pagination/infinite loader, filters/date/tags, generic job polling.
## Phase 2 — low-risk vertical slices
1. Gallery read/detail first: proves auth, workspace, signed media, dynamic routes, filters/pagination, media rendering.
2. Workspace switch/create/invite and brand-guideline upload/poll/delete.
3. Gallery mutations: select, bulk delete/download/copy/tag, restore; verify blob/ZIP handling.
4. Fun templates read/use; hydrate studio state through explicit URL/session payload rather than Angular service singleton.
## Phase 3 — generation studios
1. Image studio: options, uploads/crop/select, rewrite/random, submit/poll, remix, result actions.
2. Upscale: upload/existing asset, factor, polling/download/detail.
3. Audio: model-specific form, generation/polling/player; transcription if UI entry is retained.
4. VTO: person/garment selection and sequential-input payload parity.
5. Video last: all modes, references, constraints, upload/crop, polling, concatenate/edit/extend. Highest form/state complexity.
Each slice: API contract tests, component interaction tests, Playwright happy/failure/unauthorized parity, side-by-side Angular comparison.
## Phase 4 — admin
1. Admin layout/role gate/dashboard charts + cleanup.
2. Users CRUD/soft-delete/restore.
3. Source assets CRUD/upload.
4. Templates CRUD.
5. Tags CRUD and gallery management.
Keep server authorization tests; UI gates are not security controls.
## Phase 5 — workflows
1. Workflow list/search/delete and execution history/details/polling.
2. Workflow schema renderer and step components.
3. Editor form graph: stable step IDs, reorder, output dependency repair, fixed/linked/mixed inputs.
4. Save/update/run modal and media resolution.
5. CSV batch parser/header validation/results.
Preserve FastAPI/GCP orchestration unchanged; add golden tests comparing Angular payload fixtures and generated OpenAPI types.
## Phase 6 — workbench
1. Port timeline data model and pure time/trim/split calculations with unit tests.
2. Port drag/scrub/playback/filter UI as isolated client component.
3. Integrate `/workbench/render`, blob download, long request cancellation/error handling.
## Phase 7 — cutover
1. Dual-run in staging; replay parity suite against Angular and Next.
2. Load-test gallery, polling, uploads, workbench binary render; check Cloud Run timeouts/body limits.
3. Accessibility/keyboard/mobile/security review; analytics/error monitoring comparison.
4. Update Docker Compose, Terraform, Firebase/Cloud Run routing, CSP/CORS, CI docs. Canary traffic, monitor, then full switch.
5. Keep Angular rollback window; delete Angular only after parity sign-off and stable production period.
## Definition of done per feature
- Route/UI/API payload/status/error/permission parity.
- No bearer tokens in web storage; backend authorization unchanged.
- Unit tests for non-trivial state transforms; integration contract tests; Playwright core journey.
- Next lint/typecheck/test/build pass in container; existing backend >=80% coverage and pre-commit pass.
## Main risks
- Auth redesign blocks true Server Components; localStorage token approach would force client-only app and preserve XSS exposure.
- Angular Material replacement and complex image/workbench/workflow widgets dominate effort, not routing.
- Browser singleton state currently carries remix/navigation context; must become typed URL/session payload or scoped React state.
- Polling across navigation needs deliberate provider ownership/cancellation.
- FastAPI schemas mix camel aliases and snake payloads; generated OpenAPI client needed.
- Long background work remains FastAPI/Cloud Run; never move into Next Route Handlers/Server Actions.
- Current duplicated/possibly stale frontend calls (`badge-info`, `badge-confetti-status`, template-from-media) need endpoint reconciliation before parity freeze.