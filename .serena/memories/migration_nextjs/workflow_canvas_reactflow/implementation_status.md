# Workflow canvas implementation coordination

Date: 2026-07-30
Status: IMPLEMENTED AND VALIDATED — V2 INDEPENDENT INPUT NODES COMPLETE
Plan: `mem:migration_nextjs/workflow_canvas_reactflow/plan`

Rules:
- No commits or branches.
- Disjoint write sets per agent.
- Backend scripts/tests through Docker only.
- DTO mapping remains server-side in BFF.
- Config refs are canonical; no React Flow metadata in backend DTO.
- Ordinary save never reorders steps.
- Keep Sidebar/WorkspaceSwitcher visible above canvas.

Initial workstreams:
A. React Flow Phase 0 compatibility: frontend-next package/lock/global CSS only.
B. Backend Ingredients-to-Image contract: backend schema/executor/provider/capabilities/tests only.
C. Frontend workflow-editor contract: types/config/mappers/hooks/tests only; add ref-list + safe IDs/normalization.
D. Graph core: new frontend-next/src/features/workflow-canvas adapters/hooks model tests only; no UI components/routes.

Agents should update this memory with changed files, validation, and blockers before finishing.

## Workstream A — React Flow setup (DONE)
- Files: `frontend-next/package.json`, `frontend-next/bun.lock`, `frontend-next/app/globals.css`.
- Added `@xyflow/react` 12.11.2 and required stylesheet.
- Peer/runtime/targeted TypeScript import checks passed against React 19.2.4.
- Full production build deferred until concurrent work settles.

## Workstream B — backend Ingredients-to-Image (DONE)
- Files: `backend/src/workflows/schema/workflow_model.py`, `backend/src/workflows_executor/workflows_executor_service.py`, `backend/tests/workflows_executor/test_workflows_executor_service.py`.
- Added optional list-capable `GenerateImageInputs.input_images`, ordered media resolution, Gemini-image capability/limit validation, and forwarding to existing image API fields.
- Docker validation: workflow/workflow-executor tests 37 passed; changed source coverage 98%/83%; scoped addlicense+black passed.

## Workstream C — frontend workflow-editor contracts (DONE, integration review pending)
- Added `ref-list`, ordered ref arrays, safe ID generation/atomic normalization, parameter normalization/cascade, save-time normalization, legacy-form inert list summary, and tests.
- Tests: workflow-editor 54 passed; workflows 30 passed; lint passed.
- Integration blocker: `IMAGE_REFERENCE_MODELS` remains empty until model capability wiring is aligned with backend.

## Workstream D — graph core
- Multiple agents timed out after leaving partial files. Focused tests currently report two graph-adapter failures; continuation required.

## Workstream E — canvas panels (DONE)
- Added prop-driven toolbar, palette, inspector, and mobile drawers plus 19 passing component tests.
- Focused ESLint passed.

## Capability integration (DONE)
- Frontend exports per-model image input limits matching backend `GenerationModelEnum`: Gemini 2.5 = 2, Gemini 3/3.1 variants = 14, others = 0.
- Workflow-editor/workflows tests: 86 passed; focused ESLint passed.
- Interim map is documented for replacement when BFF exposes server-driven model capability metadata.

## Graph/visual/state core (DONE)
- Graph adapters/validation/layout storage complete; 47 graph-core tests passed.
- React Flow visual core and capability-gated handles complete.
- `useWorkflowCanvas` orchestrates canonical draft, controlled RF state, explicit reorder confirmation, connect/disconnect/delete, saved-only layout, dirty/save/run state.
- Full frontend suite after orchestration: 399 passed; ESLint clean.

## Composition/routes (DONE)
- Full-screen editor composed under `ReactFlowProvider`; Sidebar/WorkspaceSwitcher/LoadingBar retained above z-40 canvas.
- Step label editing wired.
- `/workflows/new` and `/workflows/[id]/edit` default to canvas; `?view=form` fallback retained.
- Route loading/error boundaries added.
- Full frontend tests before final review: 399 passed; scoped route/canvas lint clean.

## Final review fixes (DONE)
- Atomic downstream-ref cleanup on confirmed force-delete; exactly one confirmation.
- User-input parameter rename cascades dependent scalar/ref-list refs atomically.
- Dirty navigation guards cover toolbar, same-origin anchor navigation, reload/tab close; browser back remains a documented Next App Router public-API limitation.
- Mobile drawers trap/restore focus; workflow validation remains visible; node labels are headings; mobile RF controls avoid WorkspaceSwitcher.
- Desktop safe areas clear both Sidebar and maximum WorkspaceSwitcher pill without shrinking the canvas body.
- Saved-layout writes prune stale hashes for the same workflow only.
- Backend unresolved StepOutputReference inputs fail clearly rather than silently dropping.

## Final validation
- Frontend: 434 tests passed, ESLint clean, Next 16 production build passed (59/59 static pages; workflow routes compiled).
- Backend Docker suite: 468 passed, 1 skipped; total src coverage 83.66% (>=80%).
- Diagnostics: 0 errors; existing warnings only.
- Independent frontend/a11y re-review: ship, no blockers.
- Workflow E2E spec added at `frontend-next/tests/e2e/workflows.spec.ts`: unauthenticated redirect passed; 6 authenticated canvas scenarios are gated on real `E2E_STORAGE_STATE` plus `E2E_WORKFLOWS_ENABLED=1` and were skipped in this environment.
- Containerized pre-commit: addlicense and black passed; full run blocked by existing Angular gts environment (`eslint` ENOENT). Frontend-next ESLint and backend scoped pre-commit/pylint passed independently.
- No commits or branches created.

## Dynamic connection revision
- Canvas root width reservation removed; palette/canvas/inspector span the full viewport from x=0 while Sidebar/WorkspaceSwitcher float above at higher z-index. Toolbar alone retains switcher clearance.
- `StepFieldSpec.acceptsRef` adds whole-value literal-or-reference prompt ports for text/image/edit/video/audio.
- Added backend-supported media ports: text image/video lists; video image list/start/end frame; VTO model/top/bottom/dress/shoes; edit multi-image list.
- Generic ref-lists accept dynamic fan-in; only image Ingredients fields are model-capability/max gated.
- React Flow `useUpdateNodeInternals` refreshes geometry when dynamic user-input/model handles change; controlled reconciliation preserves measured dimensions.
- Inspector renders linked prompt refs as accessible chips with Disconnect/Use literal value instead of `[object Object]`.
- Edges are config-derived smoothstep arrows with larger interaction width and selected/focus styling.
- Dev-only connection logs include IDs/handles/reason only; no workflow content/config payload.
- Validation: 491 frontend tests passed, ESLint clean, Next production build passed; source diagnostics clean.
- Playwright connection smoke added; unauth test passed and authenticated connection scenario is gated by real workflow-role storage state.