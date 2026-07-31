# Full-screen React Flow workflow builder — implementation plan

Date: 2026-07-30
Status: USER REVIEWED — ALL SIX DECISIONS APPROVED; MODEL-CAPABILITY-GATED MULTI-IMAGE FAN-IN INCLUDED — NO CODE CHANGES
Source request: replace the linear workflow form with a full-screen node canvas inspired by the supplied reference, using React Flow (`@xyflow/react`).
Design authority: `frontend-next/tridorian-agent-instructions.md` + `tridorian-agent-theme-v3.json`.

## 1. Outcome and non-goals

### Target outcome
- `/workflows/new` and `/workflows/[id]/edit` open a full-viewport workflow builder layered below the existing floating Sidebar and WorkspaceSwitcher, which remain visible and interactive.
- Builder regions: top command bar, left node palette, central React Flow canvas, right node inspector, bottom-right minimap/zoom controls.
- Users add nodes by drag/drop or keyboard/tap, connect typed handles, configure the selected node, validate, save, and run.
- Desktop uses fixed palette + inspector; tablet/mobile use drawers/sheets so the canvas never creates page-level horizontal scrolling.

### P1 non-goals
- No conditional/control-flow branching, parallel execution, loops, retries, or sub-workflows. Dependency edges may fan out and converge, but the backend still executes one flat ordered step sequence.
- No backend schema migration for node positions in P1.
- No new auto-layout dependency (Dagre/ELK) in P1.
- No execution-status animation on nodes in P1; add after save/run correctness is stable.
- No `crop_image` node: backend enum contains it but the executor route and current frontend field contract do not.

## 2. Verified current-state constraints

- Current editor is a linear `WorkflowEditor` using `StepPalette`, `StepList`, and `StepCard`.
- `useWorkflowEditor` owns `WorkflowDraft`, validation, config updates, save, ID latching, and CSRF.
- `STEP_FIELDS`, `STEP_OUTPUTS`, `defaultStepConfig`, `missingRequired`, and `buildBackendStepConfig` already define strict per-node inputs/settings/outputs.
- `useWorkflowEditor.save()` continues sending the UI `{name, description, definition}` envelope to the existing BFF routes. The BFF create/update routes call `workflowDraftToCreateDto`/`workflowDraftToUpdateDto` server-side to strip `definition` and map backend discriminators. The canvas must not move this mapping client-side.
- Backend persists an ordered `steps[]`; it does not persist graph positions or edges.
- Backend `WorkflowInputItem` already permits lists of step/media references, and the executor consumes lists for existing text/edit/video media inputs. The current `generate_image` contract has no reference-image input, so Ingredients-to-Image requires a focused backend/BFF/frontend contract extension rather than a canvas-only change.
- Only `config` fields declared as `kind: "ref"` are real serialized dependencies. Legacy `WorkflowStep.outputRef` and `inputs[].sourceStepId` are UI-only/dead state ignored by `toBackendStep`; the canvas will not derive or write edges from them. Keep them only while the temporary legacy form exists, then remove them with that form.
- Cross-step references already live in ref fields as `{step, output}` and round-trip through UI config as `stepId::output`.
- Backend executes steps by array order. The canvas must validate dependency order against that array and may reorder only through an explicit user-confirmed operation.
- Exactly one `user_input` step is supported as the workflow argument source; its dynamic `outputs` define run-time parameters.
- Existing routes are inside `(studio)` layout, which mounts sidebar/workspace switcher/footer and padded `<main>`.
- Duplicate sibling route groups cannot expose the same `/workflows/new` and `/workflows/[id]/edit` URLs.
- `@xyflow/react` is not installed. React Flow CSS is required.

## 3. Route and full-screen-shell decision

### Selected approach: fixed canvas below retained floating studio chrome
Keep:
- `app/(studio)/workflows/new/page.tsx`
- `app/(studio)/workflows/[id]/edit/page.tsx`
- existing list/detail routes remain in the normal studio shell;
- `app/(studio)/workflows/[id]/run/page.tsx` remains a redirect to detail because run is launched from the canvas/modal.

Each route renders a client `WorkflowCanvasEditor` whose root is:
- `position: fixed; inset: 0; width: 100%; height: 100dvh` (avoid `100vw` scrollbar overflow);
- semantic dark canvas tokens;
- z-index above ordinary `<main>` content and Footer, but below the existing Sidebar, WorkspaceSwitcher, and global LoadingBar;
- body scroll locked while mounted and restored on unmount.

The existing Sidebar remains the current floating 72px pill. Its pinned/collapsed/hover-expanded behavior continues unchanged and it overlays the canvas rather than permanently reducing canvas width. The WorkspaceSwitcher also remains visible and interactive. Canvas toolbar/palette safe areas must prevent critical controls from being hidden beneath either floating control.

Why:
- preserves the user-approved Sidebar and WorkspaceSwitcher while maximizing canvas area;
- preserves URLs, auth gates, root providers, workspace context, and existing list/detail links;
- covers only ordinary page content/Footer during editing;
- avoids invalid duplicate route-group URLs and route-aware changes to the shared studio layout.

Canvas toolbar includes a clear Back/Exit action to `/workflows` (or browser back when safe).

### Loading/error files
Add route-local loading/error states for both creation and edit journeys or a nearest shared workflow editor boundary:
- compact full-screen canvas skeleton (toolbar + rails + canvas), not a centered text loader;
- error state with Retry and Back to workflows.

## 4. React Flow dependency and setup

- Add one dependency: `@xyflow/react` v12 stable compatible with React 19.2.4; verify peer dependencies at install and pin through Bun lockfile.
- Import `@xyflow/react/dist/style.css` in `app/globals.css` after Tailwind, following official docs.
- Interactive canvas is client-only. Server route keeps auth/data loading; pass normalized initial workflow to a `"use client"` wrapper. If runtime browser APIs require it, dynamically import the inner canvas from that client wrapper with SSR disabled.
- Canvas container must always have explicit dimensions (`height: 100dvh`, `width: 100%`) to avoid viewport-width scrollbar overflow.
- Use controlled `nodes`/`edges`, `useNodesState`, `useEdgesState`, `ReactFlowProvider`, `screenToFlowPosition`, `Controls`, `MiniMap`, and `Background`.

## 5. Proposed feature structure

New feature slice:

```text
src/features/workflow-canvas/
  index.ts
  components/
    workflow-canvas-editor.tsx     # full-screen composition + ReactFlowProvider
    canvas-pane.tsx                # ReactFlow, drop/connect/select/delete handlers
    canvas-toolbar.tsx             # back, name, status, validation, save, run
    step-palette-rail.tsx          # grouped drag + tap-to-add palette
    node-inspector.tsx             # config/user-input fields/validation
    base-workflow-node.tsx         # shared node rendering, typed handles
    mobile-canvas-drawers.tsx      # palette + inspector sheets
  hooks/
    use-workflow-canvas.ts         # adapter around useWorkflowEditor + RF state
    use-canvas-layout-storage.ts   # saved-workflow positions/viewport local persistence
  adapters/
    graph-adapter.ts               # pure steps/nodes/edges/ref/order functions
    graph-validation.ts            # cycles, ports, singleton input, required refs
  __tests__/
    graph-adapter.test.ts
    graph-validation.test.ts
    layout-storage.test.ts
```

Existing `src/features/workflow-editor` remains the backend-compatible draft/config layer. Canvas does not duplicate DTO mapping.

Focused existing-contract changes for Ingredients-to-Image:
- backend workflow schema: add optional list-capable `input_images` to `GenerateImageInputs` using existing `WorkflowInputItem`;
- backend model/provider capability: distinguish IMAGE multi-reference support and provider-specific maximum from the existing VIDEO `reference_images` flag;
- backend executor/provider mapping: resolve the ordered media-reference list and pass it only to a compatible image model API;
- frontend draft/config types: allow `BackendInputRef[]` and add `StepFieldSpec.kind: "ref-list"`;
- existing server-side BFF mappers: preserve the ordered ref array while continuing to own draft-envelope -> backend DTO conversion.

## 6. Screen architecture

### Top toolbar
- Back/exit.
- Inline workflow name; description opens a small details panel rather than consuming canvas height.
- Draft/Saved badge and dirty indicator.
- Validation count button; opens inspector validation section.
- Save as the single primary action.
- Run as secondary; disabled until saved and valid.
- Optional overflow menu for legacy form fallback during rollout.

### Left palette
Groups driven from existing `StepType` catalog:
- Inputs: User input.
- Generate: Text, Image, Video, Audio.
- Transform: Edit image, Virtual try-on.

Each item:
- icon + label + short purpose;
- draggable for mouse/pen;
- explicit Add button/tap behavior for touch and keyboard;
- 44px target and focus-visible token;
- User input disabled after one is present.

### Canvas
- dark semantic `--tri-bg-page` canvas with subtle dotted background;
- custom nodes, typed handles, connection preview, selection, pan/zoom/fit;
- empty-state guidance inside the canvas;
- no decorative animated edges; reduced-motion respected;
- edge direction left-to-right.

### Right inspector
For selected node:
- Identity: label and technical step ID.
- Configuration generated from `STEP_FIELDS[type]` using existing `Field`, `Input`, selects, checkboxes.
- User input node: dynamic parameter name/type editor using existing `inputParams` transforms.
- Connections: incoming reference summary and explicit Disconnect controls.
- Validation: node-local missing fields and incompatible connections.
- Delete node action; confirmation required when downstream nodes depend on it.

No selection:
- concise guidance and workflow validation summary.

### Minimap and controls
- React Flow MiniMap, zoom, fit, viewport lock.
- type colors use semantic data-visualization aliases and are always paired with icon/text.
- keep React Flow attribution visible in P1, as approved.

## 7. Node model

```ts
type WorkflowCanvasNodeData = {
  stepId: string;
  stepType: StepType;
  label: string;
  config: ConfigValues;
  inputParams?: InputParam[];
  validation: string[];
};

type WorkflowCanvasNode = Node<WorkflowCanvasNodeData>;
```

Rules:
- `node.id === WorkflowStep.id === backend stepId`.
- Identifier-safe IDs are mandatory: `^[A-Za-z][A-Za-z0-9_]*$`. New IDs use a deterministic-safe generator such as `<type>_<timestamp>_<suffix>`, never raw UUIDs with hyphens.
- Phase 0 adds a pure existing-workflow ID normalizer: build an old->safe ID map, rewrite every step ID and every serialized config ref atomically, preserve step array order, and test collision handling. Execution-history snapshots remain untouched; only the edited workflow definition is migrated on save.
- User-input parameter output names must also normalize to identifier-safe unique names. Names beginning with a digit receive a stable prefix (for example `input_`). Renames must cascade all dependent refs.
- One visual node per workflow step.
- One shared `BaseWorkflowNode` with semantic variants instead of seven duplicated node components.
- Source handles:
  - fixed from `STEP_OUTPUTS[type]` for generated nodes;
  - dynamic from user-input parameters for the singleton user-input node.
- Target handles: one per `STEP_FIELDS[type]` field with `kind: "ref"` or `kind: "ref-list"`.
- One source output may feed multiple compatible target fields on different nodes (dependency fan-out).
- One target node may receive multiple incoming edges when they terminate at different declared scalar ref fields (dependency convergence/fan-in).
- Each `kind: "ref"` scalar target handle accepts only one incoming edge.
- Add `kind: "ref-list"` for model-capability-gated multi-reference inputs. A ref-list target accepts multiple compatible source edges and serializes an ordered `BackendInputRef[]`.
- Generate Image exposes an Ingredients/Reference images ref-list only when the selected model advertises multi-image generation/editing support. Limits come from provider/model capability metadata; do not hardcode one global maximum.
- Models without that capability keep the handle hidden/disabled and reject persisted incompatible list refs during validation.

## 8. Edge/ref mapping — single source of truth

Backend-compatible step config remains the source of truth; React Flow edges are derived views.

Pure adapter API:

```text
stepsToNodes(steps, savedLayout) -> nodes
stepsToEdges(steps) -> edges
connectionToConfigPatch(connection, targetFieldSpec) -> replace scalar ref or append ordered ref-list item
removeEdgeToConfigPatch(edge, targetFieldSpec) -> clear scalar ref or remove only the matching ref-list item
validateExecutionOrder(steps, edges) -> validation result
reorderStepsTopologically(steps, edges, previousOrder) -> WorkflowStep[]  # explicit confirmed action only
```

Connect behavior:
1. Validate source output type equals target field `refType`, and validate scalar/list cardinality plus selected-model capability and maximum.
2. Reject self-edge, duplicate source-to-handle connection, scalar target-handle replacement without an explicit disconnect, capability/limit violation, type mismatch, or cycle. If source currently follows target, require explicit confirmation to update execution order before connecting.
3. Through `updateStepConfig`, write `${sourceStepId}::${sourceOutput}` for a scalar ref or append it to the ordered ref-list without duplicating an existing source/output pair.
4. Derive edges again from draft config.

Disconnect behavior clears a scalar target field or removes only the matching ref-list item through `updateStepConfig`.

Never serialize React Flow position, dimensions, selected state, viewport, or style into backend step DTOs.

## 9. Ordering and validation

### Ordering
- Backend execution order remains the explicit `draft.definition.steps[]` order. Canvas position and node dragging never change execution order.
- Existing workflows keep their array order exactly when loaded and saved.
- Save validates that every dependency source appears before its target; it never silently topologically reorders an existing workflow.
- New connections are allowed immediately when source already precedes target. If source is later, the UI must ask for an explicit `Update execution order` confirmation; accepting performs a stable topological reorder and shows the resulting ordinal badges, while cancelling leaves the graph unchanged.
- Disconnected nodes retain their prior array order. Deterministic visual auto-layout reads execution order but never writes it.
- Nodes display an execution-order ordinal so the linear backend semantics are visible despite the canvas presentation.

### Save-blocking validation
- workflow name required;
- exactly one singleton user-input node, matching the current backend workflow-argument contract;
- identifier-safe unique step IDs;
- DAG only, no cycles/self edges;
- every edge references an existing source output and target ref handle;
- output type compatible with target `refType`;
- required config from `missingRequired` present;
- required scalar ref fields have one incoming edge; required ref-list fields have at least one;
- ref-list cardinality does not exceed the selected model/provider capability, and unsupported models have no list connections;
- user-input parameter names normalize uniquely and match `^[A-Za-z][A-Za-z0-9_]*$` after normalization/prefixing;
- node types restricted to seven supported executor types;
- no React Flow metadata in DTO.

Parameter rename must cascade references from the old normalized user-input output name to the new one; add a pure tested transform before enabling rename.

## 10. Position and viewport persistence

### P1
- Persist layout only for saved workflows:
  - key: `workflow-canvas:<workflowId>:<step-id-hash>`;
  - value: node positions + viewport + version.
- Unsaved workflows keep positions in component memory only. After first save/router replacement, persist under the returned workflow ID; no temporary-key migration layer.
- Hash/version mismatch discards stale layout and runs deterministic built-in layout.
- Deterministic layout without another dependency:
  - compute graph levels from refs;
  - x by level, y by stable step order;
  - disconnected nodes placed in a separate lane.

### P2 option
Add nullable backend canvas metadata for cross-device/shared layout only after the canvas behavior is accepted. This is a separate API/schema migration, not P1.

## 11. Full-screen responsive behavior

- Desktop `>=1024`: fixed palette rail, full canvas, fixed inspector.
- Tablet `768–1023`: canvas fills screen; palette and inspector are slide-over drawers.
- Mobile `<768`: full canvas with bottom toolbar; palette is bottom sheet; inspector is full-screen sheet.
- Touch always supports tap-to-add because HTML drag/drop is not reliable on touch.
- No page-level horizontal scrolling.
- Lock document scrolling while overlay is mounted; restore on exit.
- Browser back/route transition must not strand scroll lock.

## 12. Accessibility

React Flow configuration:
- `nodesFocusable={true}`;
- `edgesFocusable={true}`;
- `disableKeyboardA11y={false}`;
- customized `ariaLabelConfig` for nodes, handles, controls, minimap;
- `autoPanOnNodeFocus` enabled;
- disable unconfirmed destructive Backspace behavior (`deleteKeyCode={null}` initially); deletion through explicit controls.

App structure:
- semantic toolbar/header, palette aside, workflow canvas main, inspector aside;
- skip link to canvas;
- all controls 44px minimum;
- focus-visible 3px semantic ring;
- node type/status never color-only;
- validation changes announced politely; save/run errors as alerts/toasts;
- reduced motion disables animated edges/transitions.

## 13. Theming

Use semantic tokens only:
- canvas: `--tri-bg-page`;
- nodes/panels: `--tri-bg-surface`, `--tri-bg-surface-alt`, subtle/default borders;
- selected node: focus ring + strong border, not luminous fill;
- AI/type emphasis: violet/info tokens;
- primary green only Save/add-critical action;
- coral only destructive confirmation/error;
- technical IDs: JetBrains Mono;
- node labels/product controls: Inter;
- workflow title: Space Grotesk.

Map React Flow CSS variables/classes in a dedicated feature stylesheet or `globals.css` layer; no raw palette values.

## 14. Reuse and files to retire

Reuse unchanged where possible:
- `useWorkflowEditor` save/meta/config actions;
- `STEP_FIELDS`, `STEP_OUTPUTS`, defaults, required validation;
- mapper/transforms and backend DTOs;
- RunWorkflowModal and workflow-run hooks;
- UI primitives and toast provider.

Refactor/move logic from:
- `step-card.tsx` config fields -> `node-inspector.tsx`;
- `step-palette.tsx` -> palette rail;
- `step-list.tsx` no longer default UI.

Keep legacy `WorkflowEditor` reachable only through a temporary `?view=form` fallback. Removal gate: delete the fallback after canvas create/edit/save/run E2E passes in CI and one user acceptance cycle completes with no blocking canvas issue. Do not add a permanent environment feature-flag system.

## 15. Implementation phases

### Phase 0 — hard go/no-go gates and contract baseline
1. In an isolated dependency change, verify `@xyflow/react` v12 peer compatibility with React 19.2.4, Bun, and Next 16; import required CSS and require a production build pass before any canvas UI work. Failure stops implementation and triggers a version decision.
2. Verify CSP/style behavior in development and production output.
3. Implement and test mandatory identifier-safe generators plus atomic existing-workflow ID/ref normalization; remove raw UUID generation for new steps.
4. Add baseline tests around current BFF draft-envelope mapping, draft-to-DTO output, config refs, and execution-order preservation.
5. Verify the existing exactly-one user-input backend requirement in baseline contract tests.
6. Explicitly mark legacy `outputRef`/linked-input state as unsupported in canvas adapters.
7. Add a hard Ingredients-to-Image contract gate: define an IMAGE-specific multi-reference capability/limit, extend `GenerateImageInputs` with optional list-capable `input_images`, wire executor/provider request mapping, and require an end-to-end backend contract test before exposing the canvas ref-list handle. Google Cloud documents multi-image fusion for Gemini 2.5 Flash Image, but each configured model must opt in explicitly.

### Phase 1 — graph adapter and validation (pure first)
1. Implement steps<->nodes/edges adapters, including ordered `ref-list` round-tripping.
2. Implement connection type/cardinality/model-capability validation and cycle prevention.
3. Implement dependency-order validation plus an explicit, user-confirmed stable topological reorder operation; never reorder during ordinary save.
4. Implement user-input parameter rename cascade.
5. Unit-test all pure behavior before UI.

### Phase 2 — full-screen canvas shell
1. Build on the dependency/CSS baseline already verified by the Phase 0 production-build gate.
2. Build the fixed canvas layer, scroll lock, toolbar/safe areas, canvas dimensions, and z-index contract that retains the Sidebar and WorkspaceSwitcher above it.
3. Replace new/edit route render targets with canvas default.
4. Add loading/error fallbacks and temporary legacy query fallback.

### Phase 3 — nodes, palette, inspector
1. Base custom node with typed/dynamic handles.
2. Drag/drop + tap/keyboard add.
3. Inspector generated from existing field specs.
4. Connect/disconnect/delete flows with confirmations, including append/remove behavior and capacity feedback for multi-reference handles.
5. Empty and validation states.

### Phase 4 — persistence and run/save integration
1. Local position/viewport persistence + deterministic fallback layout.
2. Save through existing client-side `useWorkflowEditor`; keep draft-envelope -> backend DTO mapping exclusively server-side in the existing BFF routes.
3. Preserve router replacement after first create.
4. Run modal integration with workspace ID path preserved.
5. Dirty-state navigation confirmation.

### Phase 5 — responsive/a11y/polish
1. Tablet/mobile drawers and touch add.
2. Keyboard and screen-reader pass.
3. Reduced-motion pass.
4. Performance profiling with 50/100 nodes.
5. Visual parity review against Tridorian theme and reference interaction model.

### Phase 6 — rollout
1. Canvas default for new/edit; temporary `?view=form` escape hatch.
2. Instrument client errors/save failures without workflow payload logging.
3. Remove legacy form after acceptance window.
4. P2 backlog: execution overlays, undo/redo, align tools, shared position metadata.

## 16. Test plan

### Unit
- canvas adapter round-trip: workflow step/config -> node/edges -> draft step/config;
- BFF contract round-trip: draft envelope -> backend DTO in server-side route tests; canvas code never invokes the DTO mapper client-side;
- ref config -> edge and connect -> config;
- valid one-output-to-many-target fan-out and many-distinct-inputs-to-one-node convergence;
- valid multiple image sources into one capability-enabled ordered ref-list handle;
- ref-list append, individual disconnect, ordering, model capability, and maximum-cardinality validation;
- reject multiple edges into the same scalar target handle;
- invalid handles/type mismatch;
- cycle/self-edge/duplicate target rejection;
- dependency-order validation and explicit confirmed topological reorder;
- existing/disconnected-node stable ordering with no save-time reorder;
- singleton user-input rule;
- user-input rename cascade;
- layout storage version/hash invalidation;
- no React Flow metadata in save DTO.

### Component
- palette keyboard/tap add;
- selecting node opens correct inspector fields;
- editing inspector updates draft;
- connect/disconnect updates target config;
- required validation blocks Save;
- delete dependency confirmation;
- toolbar saved/draft/dirty states.

### E2E
- create workflow: add nodes -> connect -> configure -> save -> route replaces to edit;
- Ingredients-to-Image: connect Image A + Image B to a supported Generate Image model -> save -> execute -> produce Image C; unsupported models do not expose/accept the ref-list;
- reload: workflow config and local layout restore;
- edit existing backend workflow: graph derives correctly;
- run saved workflow with workspace context;
- retained Sidebar/WorkspaceSwitcher remain visible and interactive above the desktop canvas, including Sidebar pin/collapse/hover expansion;
- mobile palette/inspector sheets and no horizontal page scroll;
- keyboard-only add/select/configure/save;
- reduced-motion behavior.

### Required validation
- targeted workflow-canvas tests;
- full `bun run --cwd frontend-next test`;
- `bun run --cwd frontend-next lint`;
- `bun run --cwd frontend-next build`;
- Playwright workflow smoke/E2E;
- scoped Docker pre-commit;
- targeted backend workflow schema/executor/provider tests are required because Ingredients-to-Image adds a focused P1 contract extension;
- coverage remains >=80% where enforced.

## 17. Risks and mitigations

- Dual source of truth -> refs/config are canonical; edges always derived.
- Canvas drag changes execution order -> dragging position never changes step order; only an explicit, user-confirmed `Update execution order` action may run the stable topological reorder operation.
- Existing non-identifier-safe IDs -> mandatory Phase 0 atomic normalization/migration rewrites step IDs and all dependent config refs before save, with collision and order-preservation tests.
- Touch DnD failure -> mandatory tap-to-add.
- Local-only layout -> deterministic fallback; backend metadata is separate P2.
- Large graph performance -> memoized node types/data, controlled updates, test at 100 nodes.
- Accidental deletion -> explicit action + downstream confirmation; keyboard delete disabled initially.
- CSP/CSS issues -> Phase 0 production build spike.
- Backend feature mismatch -> palette limited to seven supported executor nodes; allow dependency fan-out/convergence but make no control-flow or parallel-execution claims.
- Multi-image model drift -> capability and maximum come from backend model/provider metadata; unsupported models fail validation and never receive list inputs.
- Run/execution status enum drift -> keep P1 run modal behavior unchanged; normalize node status only in later execution-overlay phase.

## 18. User review decisions

1. **Approved with revision:** keep the existing floating Sidebar and WorkspaceSwitcher visible and interactive above the full-viewport canvas. Preserve Sidebar pinned/collapsed/hover-expanded behavior.
2. **Approved:** persist positions/viewport locally in P1; add database-backed cross-device layout later as a separate P2 schema/API migration.
3. **Approved:** User input is one required singleton node with multiple dynamic parameter handles.
4. **Approved:** canvas is the default, with temporary `?view=form` fallback and no permanent environment feature flag.
5. **Approved with multi-image extension:** P1 permits dependency fan-out and convergence while execution remains sequential:
   - one output may connect to compatible inputs on multiple downstream nodes;
   - multiple upstream nodes may connect to different declared scalar input handles on one downstream node;
   - multiple image sources may connect to one ordered `ref-list` Ingredients/Reference images handle when the selected generation model explicitly supports it, producing one output image;
   - models without multi-reference capability cannot expose or accept that list handle;
   - scalar handles still accept only one source;
   - these graph shapes do not imply parallel or conditional execution.
6. **Approved:** React Flow attribution remains visible in P1.
