/** Copyright 2026 Google LLC — Apache-2.0
 * Full-screen React Flow workflow canvas composition (plan §3, §5, §6, §11).
 *
 * Outer `ReactFlowProvider` + inner `useWorkflowCanvas` consumer (the hook calls
 * `useReactFlow`, so it must live inside the provider). The editor owns ONLY the
 * full-screen shell, body scroll-lock, z-index safe areas, and the wiring between
 * the completed hook and the completed prop-driven panels (toolbar / palette /
 * canvas pane / inspector / mobile drawers). All graph state and draft ownership
 * stays in `useWorkflowCanvas` (which wraps `useWorkflowEditor`); this file NEVER
 * calls `workflowDraftToCreateDto` (plan §17) — the run definition is derived from
 * `inputParams` by the hook's `buildRunDefinition`.
 *
 * z-index contract: the canvas is `z-40` — above ordinary <main>/Footer (auto)
 * and below the retained floating chrome: WorkspaceSwitcher (z-101), Sidebar
 * (z-1000), and the global LoadingBar (z-9999). Mobile drawers (z-60) render
 * inside this stacking context, so they overlay the canvas rails but remain under
 * the floating chrome. The shell spans the full viewport from x=0: the palette /
 * canvas / inspector row is NOT inset, and the WorkspaceSwitcher (z-101) and
 * Sidebar (z-1000) — both `fixed` and above the canvas z-40 — visibly overlap the
 * palette/canvas on top by design. Only the toolbar gets a left clearance (see
 * TOOLBAR_WRAPPER_CLASS) so Back/title/name clear the WorkspaceSwitcher pill. On
 * mobile (<md) nothing is inset so the full-width mobile layout is preserved. */
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import { ReactFlowProvider, useStoreApi, type Connection, type Edge } from "@xyflow/react";
import { usePathname, useRouter } from "next/navigation";

import { Button, ConfirmDialog, useToast } from "@/src/components/ui";
import { RunWorkflowModal } from "@/src/features/workflows/components/run-workflow-modal";
import type { WorkflowDraft, WorkflowStep } from "@/src/features/workflow-editor/types";
import {
  STEP_FIELDS,
  modelSupportsImageReferences,
  type BackendInputRef,
  type StepFieldSpec,
} from "@/src/features/workflow-editor/hooks/step-configs";

import { CanvasPane } from "./canvas-pane";
import { CanvasToolbar } from "./canvas-toolbar";
import { NodeInspector, type InspectorConnectionSummary, type InspectorRefFieldState, isBackendInputRefValue } from "./node-inspector";
import { StepPaletteRail, STEP_DRAG_TYPE, parseDragKind } from "./step-palette-rail";
import { MobileCanvasDrawers } from "./mobile-canvas-drawers";
import { fieldForConnection, normalizeConnection, useWorkflowCanvas } from "../hooks/use-workflow-canvas";
import { refsForField, scalarRefValueOf } from "../adapters/graph-adapter";
import { validateConnection } from "../adapters/graph-validation";
import { applyAutoLayout } from "../adapters/auto-layout";
import type { CanvasAddKind, ModelCapabilityMap, WorkflowCanvasEdge, WorkflowCanvasNodeData } from "../graph-types";

/* useLayoutEffect on the client (sync measurement before paint) so the floating
 * overlays never flash at the default `top: 0` over the toolbar; useEffect on
 * the server to avoid the React useLayoutEffect-SSR warning. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type WorkflowCanvasEditorProps = { initial?: Partial<WorkflowDraft> & { steps?: unknown } };

/** Left clearance wrapping ONLY the canvas toolbar so its Back/title/name never
 * sit under the floating WorkspaceSwitcher pill (max ~17rem / 272px wide, rooted
 * at `left: 5vw` md / `3vw` xl, z-101). The shell root reserves NO left
 * safe-area: the palette/canvas/inspector row spans the full viewport from x=0,
 * and the WorkspaceSwitcher (z-101) and Sidebar (z-1000) — both `fixed` and
 * above the canvas z-40 — visibly overlap that row on top by design. Only the
 * toolbar needs clearance, so the wrapper pushes toolbar content to the pill's
 * right edge = (5vw|3vw) + 17rem; the header's own `px-3` (12px) gives the gap
 * past the pill. Mobile (`max-md`) is untouched (the pill docks bottom-left
 * there). Exported so the DOM-less Bun runner can guard the invariant (see
 * workflow-canvas-editor.test.ts). */
export const TOOLBAR_WRAPPER_CLASS =
  "border-b border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] " +
  "md:pl-[320px] xl:pl-[320px] " +
  "[&>header]:border-b-0";

/** Skip-to-canvas link focus style. On focus it appears in the toolbar-cleared
 * area (past the studio WorkspaceSwitcher pill at 320px) so the pill
 * (z-1002) never occludes it. Mobile keeps the top-left default because the pill
 * docks bottom-left <md. Exported so the DOM-less Bun runner can guard the
 * clearance invariant (see workflow-canvas-editor.test.ts). */
export const SKIP_TO_CANVAS_LINK_CLASS =
  "sr-only focus:not-sr-only focus:absolute focus:top-[var(--tri-space-3)] focus:z-[70] " +
  "focus:left-[var(--tri-space-3)] md:focus:left-[320px] xl:focus:left-[320px] " +
  "focus:rounded-[var(--tri-radius-md)] focus:bg-[var(--tri-bg-surface)] focus:px-[var(--tri-space-3)] " +
  "focus:py-[var(--tri-space-2)] focus:text-[var(--tri-text-primary)]";

/* ------------------------------- pure helpers -------------------------------
 * Exported so Bun's DOM-less runner can cover them; the component body needs a
 * React Flow context so it is exercised through integration/E2E instead. */

/** Read the dragged palette kind from an HTML5 DnD payload via the palette's
 *  type-safe parser. Returns null for an empty/foreign payload (and for the
 *  hidden `user-input` singleton, which is never a palette drag kind) — the drop
 *  path never casts an unknown string to a step type. Pure. */
export function readDropKind(dataTransfer: DataTransfer | null): CanvasAddKind | null {
  if (!dataTransfer) return null;
  return parseDragKind(dataTransfer.getData(STEP_DRAG_TYPE));
}

/** Edges terminating at `nodeId` — force-delete clears these refs before removal. Pure. */
export function incomingEdgesTo(edges: WorkflowCanvasEdge[], nodeId: string): WorkflowCanvasEdge[] {
  return edges.filter((edge) => edge.target === nodeId);
}

/** Unique save-blocking issue count (graph rules + editor name/label rules). Pure. */
export function countValidationIssues(graphErrors: string[], editorErrors: string[]): number {
  return new Set([...graphErrors, ...editorErrors]).size;
}

/** True for literal-or-ref text/textarea fields that may carry a dynamic
 *  reference (`StepFieldSpec.acceptsRef`, prompt templating). Pure. */
export function fieldAcceptsRef(spec: StepFieldSpec): boolean {
  return (spec.kind === "text" || spec.kind === "textarea") && Boolean(spec.acceptsRef);
}

/** Build the per-field connection view the inspector renders. Pure. */
export function buildInspectorRefFields(
  node: WorkflowCanvasNodeData,
  steps: WorkflowStep[],
  modelCapability: ModelCapabilityMap,
): InspectorRefFieldState[] {
  const config = node.config ?? {};
  const fields = (STEP_FIELDS[node.stepType] ?? []).filter((field) => {
    if (field.kind === "ref" || field.kind === "ref-list") return true;
    // Literal-or-ref (acceptsRef) fields always participate so the inspector can
    // render their disconnect summary; any text/textarea slot holding a resolved
    // BackendInputRef object is also surfaced (otherwise it renders "[object Object]").
    if (field.kind === "text" || field.kind === "textarea") {
      return fieldAcceptsRef(field) || isBackendInputRefValue(config[field.name]);
    }
    return false;
  });
  return fields.map((field) => {
    const isList = field.kind === "ref-list";
    const declaredRef = field.kind === "ref" || field.kind === "ref-list";
    // Declared ref/ref-list read their canonical refs; literal-or-ref fields hold a
    // single scalar ref (resolved object or "step::output" string).
    const refs = declaredRef ? refsForField(config, field) : (() => {
      const one = scalarRefValueOf(config, field.name);
      return one ? [one] : [];
    })();
    const connections: InspectorConnectionSummary[] = refs.map((ref) => ({
      field: field.name,
      ref,
      sourceLabel: steps.find((step) => step.id === ref.step)?.label ?? ref.step,
    }));
    const model = String(config.model ?? "");
    const handleAvailable = isList ? modelSupportsImageReferences(model) : true;
    const capability = modelCapability[model];
    const capacity = isList && handleAvailable ? capability?.maxImageInputs : undefined;
    return { field, connections, capacity, handleAvailable };
  });
}

/** Find the derived edge that materializes one incoming connection on a target
 *  field, so the inspector's Disconnect control can hand it to the canvas
 *  disconnect path (clears a scalar ref or removes one ordered ref-list item).
 *  Pure. */
export function findDisconnectEdge(
  edges: WorkflowCanvasEdge[],
  targetId: string,
  field: string,
  ref: BackendInputRef,
): WorkflowCanvasEdge | undefined {
  return edges.find(
    (edge) =>
      edge.target === targetId &&
      edge.targetHandle === field &&
      edge.source === ref.step &&
      edge.sourceHandle === ref.output,
  );
}

/** How an anchor href relates to the editor route. Drives the dirty-navigation
 *  guard: only `leaves-editor` same-origin clicks are intercepted into the
 *  accessible confirm dialog. Pure. */
export type NavigationTargetKind = "leaves-editor" | "internal" | "external";

/** Classify a raw anchor `href` against the current location.
 *  - `internal`: same origin AND same pathname (query/hash-only, e.g. the
 *    WorkspaceSwitcher workspace query sync) — never blocked.
 *  - `leaves-editor`: same origin, different pathname (Sidebar links, etc.).
 *  - `external`: different origin — left to the browser (beforeunload still
 *    guards reload/tab close). */
export function classifyNavigationTarget(
  current: { pathname: string; origin: string },
  href: string,
): NavigationTargetKind {
  if (!href) return "internal";
  // Hash/query-only links stay on the current pathname (in-page jump / query sync).
  if (href.startsWith("#") || href.startsWith("?")) return "internal";
  let url: URL;
  try {
    url = new URL(href, `${current.origin}${current.pathname}`);
  } catch {
    return "internal"; // unresolvable -> let the browser handle it
  }
  if (url.origin !== current.origin) return "external";
  return url.pathname === current.pathname ? "internal" : "leaves-editor";
}

/* ------------------------------- inner consumer ------------------------------ */

function CanvasInner({ initial }: WorkflowCanvasEditorProps) {
  const canvas = useWorkflowCanvas(initial);
  const router = useRouter();
  const pathname = usePathname();
  const { show } = useToast();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [backConfirm, setBackConfirm] = useState(false);
  // Confirmed force-delete: shown only when the initial guard reports dependents.
  const [forceDeleteConfirm, setForceDeleteConfirm] = useState(false);
  const [forceDeleteCount, setForceDeleteCount] = useState(0);
  // Dirty anchor-navigation confirm (Sidebar links, etc.) routed through the
  // accessible dialog instead of window.confirm.
  const [navConfirm, setNavConfirm] = useState(false);

  const store = useStoreApi();
  const forceDeleteIdRef = useRef<string | null>(null);
  const intendedHrefRef = useRef<string | null>(null);
  const canvasRef = useRef(canvas);
  // Explicit drawer-trigger refs so focus restoration is robust instead of
  // relying solely on the activeElement-at-open fallback.
  const paletteTriggerRef = useRef<HTMLButtonElement>(null);
  const inspectorTriggerRef = useRef<HTMLButtonElement>(null);
  /** Live height of the floating toolbar. The Details textarea toggles it, so it
   *  is measured (ResizeObserver) rather than hardcoded, then published as the
   *  `--canvas-toolbar-h` CSS var so every overlay can anchor below the toolbar
   *  without reserving any canvas flex height. */
  const toolbarSurfaceRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  useEffect(() => {
    canvasRef.current = canvas;
  });

  /* Track the floating toolbar height so palette/inspector/mobile-trigger
   *   overlays anchor below it (the Details textarea toggles the height). */
  useIsoLayoutEffect(() => {
    const el = toolbarSurfaceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setToolbarHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Body scroll-lock for the full-screen overlay; restored on unmount. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* Persist layout (saved-workflow only) once on unmount, capturing the live viewport. */
  useEffect(() => () => canvasRef.current.persistLayout(), []);

  /* Track the React Flow viewport imperatively (no extra renders) so the unmount
   * persist captures the live pan/zoom. `onViewportChange` is a stable callback. */
  const { onViewportChange } = canvas;
  useEffect(() => {
    let prev = "";
    return store.subscribe((state) => {
      const [x, y, zoom] = state.transform;
      const key = `${x}:${y}:${zoom}`;
      if (key === prev) return;
      prev = key;
      onViewportChange({ x, y, zoom });
    });
  }, [store, onViewportChange]);

  const saved = Boolean(canvas.draft.id);
  const valid = canvas.validation.ok && canvas.editorErrors.length === 0;
  const canRun = saved && valid && !canvas.saving;
  const validationCount = countValidationIssues(canvas.validation.errors, canvas.editorErrors);

  const selectedNode = useMemo(
    () => canvas.nodes.find((node) => node.id === canvas.selectedStepId)?.data ?? null,
    [canvas.nodes, canvas.selectedStepId],
  );
  const refFields = useMemo(
    () =>
      selectedNode
        ? buildInspectorRefFields(selectedNode, canvas.draft.definition.steps, canvas.modelCapability)
        : [],
    [selectedNode, canvas.draft.definition.steps, canvas.modelCapability],
  );

  /* Save: the hook validates, persists layout under the returned id, and rebases
   * dirty. Toast + route replacement happen only after the first create. */
  const handleSave = useCallback(async () => {
    try {
      const { id } = await canvas.save();
      show("Workflow saved.", "success");
      if (id && !initial?.id) router.replace(`/workflows/${encodeURIComponent(id)}/edit`);
    } catch (error) {
      show(error instanceof Error ? error.message : "Workflow save failed.", "danger");
    }
  }, [canvas, show, router, initial]);

  /* Connect: write the config ref patch and automatically derive execution order
   * from the resulting graph. Surface only genuine rejections as a toast. */
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;
      const result = canvas.connect({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });
      if (!result.ok && result.reason) show(result.reason, "warning");
    },
    [canvas, show],
  );

  /* Live connection validation while dragging (the reorder case is allowed and
   * applied automatically on drop). Source is
   * normalized from a virtual input node id to its backend singleton/output via
   * the SAME helper the hook's `connect` uses, so the live gate and the final
   * write agree exactly (no double normalization). */
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return false;
      const effective = normalizeConnection({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });
      if (!fieldForConnection(canvas.draft.definition.steps, effective)) return false;
      const result = validateConnection({
        steps: canvas.draft.definition.steps,
        conn: effective,
        modelCapability: canvas.modelCapability,
      });
      return result.ok || Boolean(result.requiresReorder);
    },
    [canvas],
  );

  /* Palette drop: resolve the dragged kind + drop position via the hook. */
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const kind = readDropKind(event.dataTransfer);
      if (!kind) return;
      event.preventDefault();
      canvas.addNode(kind, { x: event.clientX, y: event.clientY });
    },
    [canvas],
  );

  /* Delete: the hook blocks deletion while downstream refs exist. When blocked,
   *   surface an explicit, accessible confirm; confirming calls the hook's atomic
   *   `forceRemoveNode`, which clears every downstream ref and drops the node in
   *   one batch (no dangling refs, no multi-disconnect race). */
  const handleDelete = useCallback(() => {
    const id = canvas.selectedStepId;
    if (!id) return;
    const guard = canvas.removeNode(id);
    if (!guard.blocked) return;
    forceDeleteIdRef.current = id;
    setForceDeleteCount(guard.dependents.length);
    setForceDeleteConfirm(true);
  }, [canvas]);

  const confirmForceDelete = useCallback(() => {
    const id = forceDeleteIdRef.current;
    setForceDeleteConfirm(false);
    forceDeleteIdRef.current = null;
    if (id) canvas.forceRemoveNode(id);
  }, [canvas]);

  const cancelForceDelete = useCallback(() => {
    setForceDeleteConfirm(false);
    forceDeleteIdRef.current = null;
  }, []);

  /* beforeunload: the only allowed browser-contract prompt. Covers reload, tab
   *   close, and hard cross-origin navigation. SPA route changes are guarded by
   *   the anchor-click interceptor + toolbar confirms below. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!canvasRef.current.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* Delete selected connectors directly while keeping node deletion behind its
   * guarded inspector flow. React Flow's global delete key remains disabled so a
   * selected node can never bypass the downstream-dependency confirmation. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (
        forceDeleteConfirm ||
        backConfirm ||
        navConfirm ||
        runOpen ||
        paletteOpen ||
        inspectorOpen
      ) {
        return;
      }
      const selectedIds = new Set(
        store
          .getState()
          .edges.filter((edge) => edge.selected)
          .map((edge) => edge.id),
      );
      if (selectedIds.size === 0) return;
      const selectedEdges = canvasRef.current.edges.filter((edge) => selectedIds.has(edge.id));
      if (selectedEdges.length === 0) return;
      event.preventDefault();
      canvasRef.current.disconnectEdges(selectedEdges);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [store, forceDeleteConfirm, backConfirm, navConfirm, runOpen, paletteOpen, inspectorOpen]);

  /* Dirty anchor-navigation guard. Sidebar/WorkspaceSwitcher live outside this
   *   component as plain `<a>`/Link chrome, so a capture-phase document listener
   *   is the supported way to intercept their clicks (Next's <Link> honors
   *   `e.defaultPrevented`). Same-origin links that LEAVE the editor route are
   *   redirected into the accessible confirm dialog; query/hash-only changes
   *   (WorkspaceSwitcher workspace sync) and external links are left alone. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const origin = window.location.origin;
    const onClick = (event: MouseEvent) => {
      if (!canvasRef.current.dirty || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target && typeof target.closest === "function" ? (target.closest("a") as HTMLAnchorElement | null) : null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
      if (classifyNavigationTarget({ pathname, origin }, href) !== "leaves-editor") return;
      event.preventDefault();
      intendedHrefRef.current = href;
      setNavConfirm(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  const handleDisconnectRef = useCallback(
    (field: string, ref: BackendInputRef) => {
      const id = canvas.selectedStepId;
      if (!id || !selectedNode) return;
      const spec = (STEP_FIELDS[selectedNode.stepType] ?? []).find((f) => f.name === field);
      // Declared ref/ref-list fields disconnect through the derived edge (the hook
      // clears a scalar ref or removes one ordered ref-list item).
      if (spec && (spec.kind === "ref" || spec.kind === "ref-list")) {
        const edge = findDisconnectEdge(canvas.edges, id, field, ref);
        if (edge) canvas.disconnect(edge);
        return;
      }
      // Literal-or-ref (acceptsRef) text/textarea fields are not cleared by the
      // hook's edge-disconnect path, so clear the slot directly: drops the
      // linked-source chip and lets the user type a literal value again.
      canvas.updateStepConfig(id, { [field]: "" });
    },
    [canvas, selectedNode],
  );

  const goBack = useCallback(() => {
    if (canvas.dirty) setBackConfirm(true);
    else router.push("/workflows");
  }, [canvas.dirty, router]);

  const openValidation = useCallback(() => {
    canvas.selectStep(null);
    setInspectorOpen(true);
  }, [canvas]);

  // React Flow's change handlers are generic over the node/edge type; the hook's
  // WorkflowCanvas-typed callbacks are structurally/runtime compatible with the
  // pane's default-typed props, so widen via the pane's own declared prop type.
  type PaneProps = ComponentProps<typeof CanvasPane>;

  const desktopPalette = (
    <StepPaletteRail variant="rail" onAdd={(kind) => canvas.addNode(kind)} />
  );
  const palette = (
    <StepPaletteRail onAdd={(kind) => canvas.addNode(kind)} />
  );
  const inspector = (
    <NodeInspector
      node={selectedNode}
      refFields={refFields}
      onUpdateLabel={(label) => {
        if (canvas.selectedStepId) canvas.updateStep(canvas.selectedStepId, { label });
      }}
      onUpdateConfig={(patch) => {
        if (canvas.selectedStepId) canvas.updateStepConfig(canvas.selectedStepId, patch);
      }}
      onUpdateInputParams={(params) => {
        if (canvas.selectedStepId) canvas.updateInputParams(canvas.selectedStepId, params);
      }}
      onDisconnectRef={handleDisconnectRef}
      onDelete={handleDelete}
      validation={canvas.validation.errors}
    />
  );

  const handleAutoLayout = useCallback(() => {
    const layouted = applyAutoLayout(canvas.nodes, canvas.edges);
    canvas.setNodes(layouted);
    canvas.persistLayout();
    show("Nodes auto-aligned.", "info");
  }, [canvas, show]);

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden bg-[var(--tri-bg-page)] text-[var(--tri-text-primary)]"
      data-theme="dark"
      style={{ "--canvas-toolbar-h": `${toolbarHeight}px` } as CSSProperties}
    >
      {/* Canvas base layer: the ReactFlow surface fills the ENTIRE viewport.
        Every chrome element is an absolute/fixed overlay above it, so none of
        them reserve the canvas's flex width/height. Overlay wrappers are
        pointer-events-none so drags/clicks on blank overlay area pass straight
        through and pan the canvas; only the real panel surfaces opt back in with
        pointer-events-auto. */}
      <main id="workflow-canvas-main" className="absolute inset-0">
        <CanvasPane
          nodes={canvas.nodes}
          edges={canvas.edges}
          onNodesChange={canvas.onNodesChange as unknown as PaneProps["onNodesChange"]}
          onEdgesChange={canvas.onEdgesChange as unknown as PaneProps["onEdgesChange"]}
          onConnect={handleConnect}
          onDrop={handleDrop}
          onNodeDragStop={() => canvas.persistLayout()}
          isValidConnection={isValidConnection}
        />
      </main>

      <a
        className={SKIP_TO_CANVAS_LINK_CLASS}
        href="#workflow-canvas-main"
      >
        Skip to canvas
      </a>

      {/* Toolbar: floats across the top. TOOLBAR_WRAPPER_CLASS pushes its content
        past the floating WorkspaceSwitcher pill ((5vw|3vw)+17rem) so Back/title/
        name clear it. The pointer-events-none wrapper lets bare strips pan the
        canvas; the surface is pointer-events-auto. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
        <div ref={toolbarSurfaceRef} className={`pointer-events-auto ${TOOLBAR_WRAPPER_CLASS}`}>
          <CanvasToolbar
            title={initial?.id ? "Edit workflow" : "New workflow"}
            name={canvas.draft.name}
            onNameChange={(name) => canvas.setMeta({ name })}
            description={canvas.draft.description ?? ""}
            onDescriptionChange={(description) => canvas.setMeta({ description })}
            saved={saved}
            dirty={canvas.dirty}
            valid={valid}
            validationCount={validationCount}
            onOpenValidation={openValidation}
            saving={canvas.saving}
            canSave={canvas.dirty || !saved}
            onSave={() => void handleSave()}
            canRun={canRun}
            onRun={() => setRunOpen(true)}
            onAutoLayout={handleAutoLayout}
            onBack={goBack}
          />
        </div>
      </div>

      {/* Mobile-only drawer triggers: float just UNDER the toolbar (anchored to
        the measured toolbar height), never at the bottom where the mobile
        WorkspaceSwitcher/Sidebar dock. lg hides them (lg shows the rails). */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--canvas-toolbar-h)+var(--tri-space-2))] z-20 lg:hidden">
        <div className="pointer-events-auto mx-[var(--tri-space-3)] flex items-center gap-[var(--tri-space-2)] rounded-[var(--tri-radius-lg)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] px-[var(--tri-space-3)] py-[var(--tri-space-1)] shadow-[var(--tri-shadow-md)]">
          <span
            className="contents"
            ref={(el) => {
              paletteTriggerRef.current = el?.querySelector("button") ?? null;
            }}
          >
            <Button variant="secondary" className="min-h-11" onClick={() => setPaletteOpen(true)}>
              Palette
            </Button>
          </span>
          <span
            className="contents"
            ref={(el) => {
              inspectorTriggerRef.current = el?.querySelector("button") ?? null;
            }}
          >
            <Button variant="secondary" className="min-h-11" onClick={() => setInspectorOpen(true)}>
              Inspector
            </Button>
          </span>
          {canvas.selectedStepId ? (
            <span className="text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">
              A node is selected — open Inspector to edit.
            </span>
          ) : null}
        </div>
      </div>

      {/* Excalidraw-style desktop tool island: centered below the workflow header,
        icon-only with concise bottom tooltips. Mobile keeps its labeled drawer. */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--canvas-toolbar-h)+var(--tri-space-3))] z-20 hidden justify-center lg:flex">
        <div className="pointer-events-auto w-max max-w-[calc(100vw-var(--tri-space-6))] overflow-visible rounded-[var(--tri-radius-lg)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] shadow-[var(--tri-shadow-md)]">
          {desktopPalette}
        </div>
      </div>

      {/* Node details stay out of the way until a node is selected. Clicking the
        canvas clears selection and hides the panel again. */}
      {selectedNode ? (
        <div className="pointer-events-none absolute bottom-[11rem] right-[var(--tri-space-3)] top-[calc(var(--canvas-toolbar-h)+var(--tri-space-3))] z-20 hidden w-[20rem] lg:block">
          <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-[var(--tri-radius-lg)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] shadow-[var(--tri-shadow-md)]">
            {inspector}
          </div>
        </div>
      ) : null}

      <MobileCanvasDrawers
        palette={palette}
        inspector={inspector}
        paletteOpen={paletteOpen}
        onPaletteOpenChange={setPaletteOpen}
        inspectorOpen={inspectorOpen}
        onInspectorOpenChange={setInspectorOpen}
        paletteTriggerRef={paletteTriggerRef}
        inspectorTriggerRef={inspectorTriggerRef}
      />


      <ConfirmDialog
        open={backConfirm}
        title="Leave without saving?"
        tone="danger"
        message="You have unsaved changes that will be lost."
        confirmLabel="Leave"
        onConfirm={() => router.push("/workflows")}
        onClose={() => setBackConfirm(false)}
      />


      {/* Confirmed force delete: clears every downstream ref atomically, then removes the node. */}
      <ConfirmDialog
        open={forceDeleteConfirm}
        title="Force delete node?"
        tone="danger"
        message={`${forceDeleteCount} step(s) reference this node. Deleting this node will break downstream dependencies.`}
        confirmLabel="Delete"
        onConfirm={confirmForceDelete}
        onClose={cancelForceDelete}
      />

      {/* Dirty same-origin navigation (Sidebar links, etc.) intercepted into the accessible dialog. */}
      <ConfirmDialog
        open={navConfirm}
        title="Leave without saving?"
        tone="danger"
        message="You have unsaved changes that will be lost."
        confirmLabel="Leave"
        onConfirm={() => {
          const href = intendedHrefRef.current;
          setNavConfirm(false);
          intendedHrefRef.current = null;
          if (href) router.push(href);
        }}
        onClose={() => {
          setNavConfirm(false);
          intendedHrefRef.current = null;
        }}
      />

      {runOpen && saved && canvas.draft.id ? (
        <RunWorkflowModal
          workflowId={canvas.draft.id}
          definition={canvas.runDefinition}
          onClose={() => setRunOpen(false)}
        />
      ) : null}

      {canvas.error ? <p className="sr-only" role="alert">{canvas.error}</p> : null}
    </div>
  );
}

/** Public entry point: the outer React Flow provider + the inner hook consumer. */
export function WorkflowCanvasEditor({ initial }: WorkflowCanvasEditorProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner initial={initial} />
    </ReactFlowProvider>
  );
}
