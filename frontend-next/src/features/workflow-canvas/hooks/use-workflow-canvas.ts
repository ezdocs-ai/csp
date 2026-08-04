/** Copyright 2026 Google LLC — Apache-2.0
 * State orchestration for the approved React Flow workflow canvas (plan §4–§10).
 *
 * `useWorkflowEditor` stays the canonical draft owner: meta/config/param/save/CSRF
 * all live there. This hook wraps it and adds the controlled React Flow surface:
 *  - controlled `useNodesState`/`useEdgesState` + `useReactFlow().screenToFlowPosition`;
 *  - node POSITIONS are canvas-owned and preserved across every draft-config change;
 *    dragging never mutates the draft or execution order;
 *  - EDGES are always re-derived from canonical config refs (`stepsToEdges`) — the
 *    hook never calls `addEdge`; connect/disconnect write config patches instead;
 *  - connect validates cycle/type/cardinality/capacity/order and, when the source
 *    runs after the target, atomically applies the edge and a stable topological
 *    reorder via the editor's safe `replaceSteps` batch mutation;
 *  - ordinary save never changes execution order;
 *  - delete carries a downstream-dependency guard;
 *  - local layout/viewport persistence is saved-workflow-only; no temporary unsaved
 *    localStorage keys are written;
 *  - save delegates to `useWorkflowEditor` (envelope -> BFF -> server-side DTO
 *    mapping) and returns a route-ready id; `workflowDraftToCreateDto` is NEVER
 *    called client-side; the run-definition helper derives user_input fields
 *    directly from `inputParams`.
 *
 * MUST be used inside `<ReactFlowProvider>` (`useReactFlow` requires the context). */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEdgesState, useNodesState, useReactFlow } from "@xyflow/react";

import type {
  CanvasAddKind,
  CanvasConnection,
  ConfigPatch,
  ConnectionValidation,
  ModelCapabilityMap,
  SavedLayout,
  ValidationResult,
  Viewport,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  XYPosition,
} from "../graph-types";
import type { ConfigValues, StepFieldSpec } from "../../workflow-editor/hooks/step-configs";
import { MODEL_IMAGE_INPUT_CAPABILITIES, STEP_FIELDS, defaultStepConfig } from "../../workflow-editor/hooks/step-configs";
import { cascadeParamRename, generateStepId, normalizeParamOutputName } from "../../workflow-editor/hooks/identifiers";
import { paramsToOutputs } from "../../workflow-editor/hooks/transforms";
import type { InputParam, InputParamType, StepType, WorkflowDraft, WorkflowStep } from "../../workflow-editor/types";
import { useWorkflowEditor } from "../../workflow-editor/hooks/use-workflow-editor";
import {
  buildModelCapabilityMap,
  connectionToConfigPatch,
  isLiteralOrRefField,
  isRefListField,
  isScalarRefField,
  refListValueOf,
  refsForField,
  removeEdgeToConfigPatch,
  scalarRefValueOf,
  stepsToEdges,
  stepsToNodes,
} from "../adapters/graph-adapter";
import type { ImageCanvasVariant } from "../adapters/virtual-inputs";
import {
  clearSingletonOutputRefFromWorkflow,
  isVirtualInputId,
  parseVirtualInputId,
  virtualInputId,
} from "../adapters/virtual-inputs";
import { reorderStepsTopologically, validateConnection, validateWorkflow } from "../adapters/graph-validation";
import { readSavedLayout, writeSavedLayout } from "./use-canvas-layout-storage";

/* --------------------------------------------------------------------------
 * Pure helpers (exported so focused RTL-free tests can cover every rule).
 * None of these touch React or React Flow.
 * ------------------------------------------------------------------------ */

/** Find the declared ref/ref-list/literal-or-ref target field for a connection
 *  intent. Mirrors `validateConnection`'s and `connectionToConfigPatch`'s field
 *  predicate (ref | ref-list | literal-or-ref textarea/text), so a Text virtual
 *  source feeding a `prompt` field passes the same gate live and on drop. */
export function fieldForConnection(steps: WorkflowStep[], conn: CanvasConnection): StepFieldSpec | undefined {
  const target = steps.find((s) => s.id === conn.target);
  if (!target) return undefined;
  return (STEP_FIELDS[target.type] ?? []).find(
    (f) =>
      f.name === conn.targetHandle &&
      (isScalarRefField(f) || isRefListField(f) || isLiteralOrRefField(f)),
  );
}

/** Resolve a connection's source from a virtual input node id back to its
 *  backend singleton step id + normalized output, so `validateConnection` and the
 *  config patch operate on the real ref. Non-virtual sources pass through
 *  unchanged. Pure (no React/RF). This is the SINGLE normalization pass shared by
 *  the live `isValidConnection` gate (editor) and the final `connect` writer
 *  (hook) — call it once, never twice. The UI-displayed edge still re-derives as a
 *  virtual source from canonical config via `stepsToEdges`. */
export function normalizeConnection(conn: CanvasConnection): CanvasConnection {
  const parsed = parseVirtualInputId(conn.source);
  return parsed ? { ...conn, source: parsed.singletonStepId, sourceHandle: parsed.output } : conn;
}

/** Step ids that reference `targetId` through any declared ref/ref-list field
 *  (downstream-dependency guard for delete). Empty when nothing depends on it. */
export function dependentStepIds(steps: WorkflowStep[], targetId: string): string[] {
  const ids = new Set(steps.map((s) => s.id));
  if (!ids.has(targetId)) return [];
  const dependents: string[] = [];
  for (const s of steps) {
    if (s.id === targetId) continue;
    const refs = (STEP_FIELDS[s.type] ?? []).flatMap((field) => refsForField(s.config ?? {}, field));
    if (refs.some((r) => r.step === targetId)) dependents.push(s.id);
  }
  return dependents;
}

/** Apply one ConfigPatch (connect/disconnect result) to a single step's config. */
export function applyConfigPatchToStep(step: WorkflowStep, patch: ConfigPatch): WorkflowStep {
  const base = step.config ?? (STEP_FIELDS[step.type].length ? defaultStepConfig(step.type) : {});
  return { ...step, config: { ...base, [patch.field]: patch.value } };
}

/** Apply the confirmed connection first, then derive backend execution order from
 * the resulting graph. Sorting before applying the patch cannot see the new
 * dependency and leaves the source after its target. */
export function applyConnectionAndReorder(steps: WorkflowStep[], patch: ConfigPatch): WorkflowStep[] {
  const patched = steps.map((step) =>
    step.id === patch.stepId ? applyConfigPatchToStep(step, patch) : step,
  );
  return reorderStepsTopologically(patched);
}

/**
 * Build the run-definition envelope consumed by the run modal's
 * `extractInputFields`, deriving user_input fields DIRECTLY from `inputParams`
 * via `paramsToOutputs`. Never touches `workflowDraftToCreateDto` (plan §17).
 */
export function buildRunDefinition(
  steps: WorkflowStep[],
): { steps: Array<{ type: "user_input"; outputs: Record<string, { type: InputParamType }> }> } {
  const ui = steps.find((s) => s.type === "user-input");
  if (!ui) return { steps: [] };
  return { steps: [{ type: "user_input", outputs: paramsToOutputs(ui.inputParams ?? []) }] };
}

/** Stable serialization for dirty detection (ignores legacy outputRef/inputs). */
export function serializeDraftForDirty(draft: WorkflowDraft): string {
  return JSON.stringify({
    name: draft.name,
    description: draft.description ?? "",
    steps: draft.definition.steps.map((s) => ({
      id: s.id,
      type: s.type,
      label: s.label,
      config: s.config,
      inputParams: s.inputParams,
    })),
  });
}

/** Build a fresh step of `type` with a caller-supplied safe id. Mirrors the
 *  editor's private `makeStep` using only exported helpers (no duplication). */
export function makeNewStep(type: StepType, id: string): WorkflowStep {
  return {
    id,
    type,
    label: type.replace("-", " "),
    inputs: [{ mode: "fixed" }],
    config: STEP_FIELDS[type].length ? defaultStepConfig(type) : undefined,
    inputParams: type === "user-input" ? [] : undefined,
  };
}

/** Strip every reference to `removedStepId` from one step's config in place-ish
 *  (returns a new step): scalar `ref` fields are cleared with the "" sentinel,
 *  `ref-list` entries are filtered out, and whole-value `step::output` prompt
 *  refs are cleared. Pure. */
function clearRefsTo(step: WorkflowStep, removedStepId: string): WorkflowStep {
  const fields = STEP_FIELDS[step.type] ?? [];
  const config = step.config;
  if (fields.length === 0 || !config) return step;
  let changed = false;
  const next = { ...config };
  for (const field of fields) {
    if (isScalarRefField(field) || field.kind === "text" || field.kind === "textarea") {
      const ref = scalarRefValueOf(config, field.name);
      if (ref && ref.step === removedStepId) {
        next[field.name] = "";
        changed = true;
      }
    } else if (isRefListField(field)) {
      const list = refListValueOf(config, field.name);
      const filtered = list.filter((r) => r.step !== removedStepId);
      if (filtered.length !== list.length) {
        next[field.name] = filtered;
        changed = true;
      }
    }
  }
  return changed ? { ...step, config: next } : step;
}

/** Force-delete cleanup: return a new step array with EVERY downstream reference
 *  to `targetId` removed (scalar refs cleared, ref-list entries dropped, loose
 *  prompt refs cleared) and then `targetId` itself dropped — in a single pass,
 *  so no dangling refs and no multi-update race. Downstream refs are the OTHER
 *  steps that point at `targetId` (outgoing edges from `targetId`). Pure. */
export function removeStepAndDownstreamRefs(steps: WorkflowStep[], targetId: string): WorkflowStep[] {
  const ids = new Set(steps.map((s) => s.id));
  if (!ids.has(targetId)) return steps;
  return steps.filter((s) => s.id !== targetId).map((s) => clearRefsTo(s, targetId));
}

/** Remove one or more selected canvas edges from canonical step configuration in
 * one atomic pass. Patches for the same target are folded against the latest
 * config so deleting several entries from one ref-list cannot reintroduce an
 * earlier entry through stale sequential updates. */
export function disconnectEdgesFromSteps(
  steps: WorkflowStep[],
  selectedEdges: WorkflowCanvasEdge[],
): WorkflowStep[] {
  if (selectedEdges.length === 0) return steps;
  const byTarget = new Map<string, WorkflowCanvasEdge[]>();
  for (const edge of selectedEdges) {
    const group = byTarget.get(edge.target) ?? [];
    group.push(edge);
    byTarget.set(edge.target, group);
  }

  return steps.map((step) => {
    const group = byTarget.get(step.id);
    if (!group) return step;
    let config = step.config ?? (STEP_FIELDS[step.type].length ? defaultStepConfig(step.type) : {});
    let changed = false;
    for (const edge of group) {
      const field = (STEP_FIELDS[step.type] ?? []).find(
        (candidate) =>
          candidate.name === edge.targetHandle &&
          (isScalarRefField(candidate) || isRefListField(candidate) || isLiteralOrRefField(candidate)),
      );
      if (!field) continue;
      const parsed = parseVirtualInputId(edge.source);
      const backendEdge = parsed
        ? { ...edge, source: parsed.singletonStepId, sourceHandle: parsed.output }
        : edge;
      const patch = removeEdgeToConfigPatch(backendEdge, field, config);
      if (!patch) continue;
      config = { ...config, [patch.field]: patch.value };
      changed = true;
    }
    return changed ? { ...step, config } : step;
  });
}

/** Ingredients-to-Image save-block augmentation: a canvas-only Ingredients
 *  variant with no connected image input is not savable. `validateWorkflow`
 *  operates on backend steps and cannot see the canvas-only variant marker, so
 *  the hook layers these extra errors on top. Pure. */
export function ingredientsValidation(
  steps: WorkflowStep[],
  variants: Record<string, ImageCanvasVariant>,
): { errors: string[]; byNode: Record<string, string[]> } {
  const errors: string[] = [];
  const byNode: Record<string, string[]> = {};
  for (const id of Object.keys(variants)) {
    if (variants[id] !== "ingredients") continue;
    const step = steps.find((s) => s.id === id);
    if (!step) continue;
    if (refListValueOf(step.config ?? {}, "input_images").length === 0) {
      const msg = "Ingredients to Image needs at least one connected image input.";
      (byNode[id] ??= []).push(msg);
      errors.push(msg);
    }
  }
  return { errors, byNode };
}

/** Unique human-facing param name for a new virtual input of `type`, avoiding
 *  normalized-output collisions with existing params (so two virtual inputs never
 *  project the same stable id). Pure. */
export function uniqueParamName(params: readonly InputParam[], type: InputParamType): string {
  const base = type === "image" ? "Image Input" : "Text Input";
  const seen = new Set(params.map((p) => normalizeParamOutputName(p.name)));
  let n = params.filter((p) => p.type === type).length + 1;
  let name = `${base} ${n}`;
  while (seen.has(normalizeParamOutputName(name))) {
    n += 1;
    name = `${base} ${n}`;
  }
  return name;
}

/** Append one unique parameter to the singleton user-input step (creating the
 *  singleton at index 0 when absent) and return the next step array plus the new
 *  virtual node id. The singleton is always retained; zero outputs are allowed.
 *  Pure. */
export function addVirtualInputParam(
  steps: WorkflowStep[],
  type: InputParamType,
  existingIds: readonly string[] = [],
): { steps: WorkflowStep[]; virtualId: string } {
  const singleton = steps.find((s) => s.type === "user-input");
  const base = singleton
    ? steps
    : [makeNewStep("user-input", generateStepId("user-input", [...existingIds, ...steps.map((s) => s.id)])), ...steps];
  const target = base.find((s) => s.type === "user-input")!;
  const name = uniqueParamName(target.inputParams ?? [], type);
  const virtualId = virtualInputId(target.id, normalizeParamOutputName(name));
  return {
    steps: base.map((s) => (s.id === target.id ? { ...s, inputParams: [...(s.inputParams ?? []), { name, type }] } : s)),
    virtualId,
  };
}

/** Step ids that reference EXACTLY `{singletonStepId, output}` — the
 *  exact-output downstream guard for deleting one virtual input node (siblings
 *  untouched). Pure. */
export function dependentStepIdsForOutput(
  steps: WorkflowStep[],
  singletonStepId: string,
  output: string,
): string[] {
  const dependents: string[] = [];
  for (const s of steps) {
    if (s.id === singletonStepId) continue;
    const refs = (STEP_FIELDS[s.type] ?? []).flatMap((field) => refsForField(s.config ?? {}, field));
    if (refs.some((r) => r.step === singletonStepId && r.output === output)) dependents.push(s.id);
  }
  return dependents;
}

/** Remove one virtual input: clear that output's refs across the workflow AND
 *  drop ONLY the matching singleton parameter, leaving the singleton (even when
 *  it becomes empty). Sibling outputs and their refs are untouched. Pure. */
export function removeVirtualInputParam(
  steps: WorkflowStep[],
  singletonStepId: string,
  output: string,
): WorkflowStep[] {
  const cleared = clearSingletonOutputRefFromWorkflow(steps, singletonStepId, output);
  return cleared.map((s) =>
    s.id === singletonStepId && s.type === "user-input"
      ? { ...s, inputParams: (s.inputParams ?? []).filter((p) => normalizeParamOutputName(p.name) !== output) }
      : s,
  );
}

/** Distinct normalized param output names for a user-input param list, in order. */
function uniqueParamOutputs(params: InputParam[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const param of params) {
    const output = normalizeParamOutputName(param.name);
    if (output && !seen.has(output)) {
      seen.add(output);
      out.push(output);
    }
  }
  return out;
}

/** Detect a single user-input parameter rename between two param lists by
 *  comparing normalized output name SETS (so reorder/add/remove never trigger a
 *  spurious cascade). Returns the {oldOutput, newOutput} pair to cascade, or null
 *  when the change is not an isolated single rename. Pure. */
export function computeParamRename(
  oldParams: InputParam[],
  newParams: InputParam[],
): { oldOutput: string; newOutput: string } | null {
  const oldOutputs = uniqueParamOutputs(oldParams);
  const newOutputs = uniqueParamOutputs(newParams);
  const removed = oldOutputs.filter((output) => !newOutputs.includes(output));
  const added = newOutputs.filter((output) => !oldOutputs.includes(output));
  if (removed.length === 1 && added.length === 1) return { oldOutput: removed[0], newOutput: added[0] };
  return null;
}

/* --------------------------------------------------------------------------
 * Development-only structured connection debug logging (plan §8).
 * Structured, never logs prompt/config/workflow payloads — only connection
 * identifiers + a short reason. Compiled out of production builds.
 * ------------------------------------------------------------------------ */

export type ConnectionLogEvent = "attempt" | "reject" | "applied";

/** Structured connection logger. Dev-only: a no-op in production so no payload
 *  data (prompt/config/workflow) ever leaks — only source/target/handle ids and
 *  an optional short reason. The guard is evaluated per call (not at import) so
 *  it reflects the build it shipped in. Exported so its shape is unit-tested. */
export function logConnectionEvent(
  event: ConnectionLogEvent,
  conn: CanvasConnection,
  reason?: string,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.debug("[workflow-canvas:connect]", {
    event,
    source: conn.source,
    sourceHandle: conn.sourceHandle,
    target: conn.target,
    targetHandle: conn.targetHandle,
    ...(reason ? { reason } : {}),
  });
}

export type DeleteGuard = { blocked: boolean; dependents: string[] };

export type UseWorkflowCanvasReturn = {
  /** Canonical draft (owned by useWorkflowEditor). */
  draft: WorkflowDraft;
  /** Graph-level save-blocking validation with per-node messages. */
  validation: ValidationResult;
  /** Editor-level errors (name/required) from useWorkflowEditor. */
  editorErrors: string[];
  /** True when the draft diverged from the last saved/loaded baseline. */
  dirty: boolean;

  /** Controlled React Flow state. */
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  setNodes: ReturnType<typeof useNodesState<WorkflowCanvasNode>>[1];
  onNodesChange: ReturnType<typeof useNodesState<WorkflowCanvasNode>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<WorkflowCanvasEdge>>[2];
  /** Screen (clientX/clientY) -> flow position; for palette drag-and-drop. */
  screenToFlowPosition: (clientPosition: { x: number; y: number }) => XYPosition;

  /** Selection (driven by React Flow's node `selected` flag). */
  selectedStepId: string | null;
  selectStep: (id: string | null) => void;

  /** Per-model multi-image capability resolved from exported per-model limits. */
  modelCapability: ModelCapabilityMap;

  /** Inspector passthroughs (step label / config / user-input params / meta).
   *  `updateInputParams` wraps the editor's setter: an isolated param rename is
   *  detected and cascaded into every dependent ref atomically (one batch),
   *  while add/remove/reorder leave refs untouched. */
  updateStep: (id: string, update: Partial<WorkflowStep>) => void;
  updateStepConfig: (id: string, patch: Partial<ConfigValues>) => void;
  updateInputParams: (id: string, params: InputParam[]) => void;
  setMeta: (update: Partial<Pick<WorkflowDraft, "name" | "description">>) => void;

  /** Palette tap + drag-and-drop add. `clientPosition` is screen space. Virtual
   *  input kinds (`text-input`/`image-input`) append a unique param to the hidden
   *  singleton and return the projected virtual node id; `ingredients-image`
   *  creates an ordinary image step plus a canvas-only Ingredients marker. The
   *  param also accepts a legacy `StepType` (the not-yet-migrated palette emits
   *  `StepType`); `user-input` is a safe no-op (v2 hides the singleton). */
  addNode: (kind: CanvasAddKind | StepType, clientPosition?: { x: number; y: number }) => string;
  /** Validate and connect; dependencies automatically receive stable execution order. */
  connect: (conn: CanvasConnection) => ConnectionValidation;
  /** Disconnect one edge: clears a scalar ref or removes one ref-list item. */
  disconnect: (edge: WorkflowCanvasEdge) => void;
  /** Atomically disconnect selected edges, used by direct keyboard deletion. */
  disconnectEdges: (edges: WorkflowCanvasEdge[]) => void;
  /** Delete with a downstream-dependency guard; returns the guard WITHOUT deleting
   *  when blocked (call `forceRemoveNode` after an explicit confirm to clear every
   *  downstream ref and remove the node atomically). */
  removeNode: (id: string) => DeleteGuard;
  /** Confirmed force delete: clears every downstream ref to `id` and drops the
   *  node in one atomic batch (`replaceSteps`) — no dangling refs, no races. */
  forceRemoveNode: (id: string) => void;

  /** Viewport (saved-workflow persistence only). */
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  persistLayout: () => void;

  /** Save through useWorkflowEditor; persists layout under the returned id. */
  save: () => Promise<{ id: string }>;
  saving: boolean;
  error: string | null;

  /** Run-definition envelope derived from inputParams (no DTO mapper). */
  runDefinition: ReturnType<typeof buildRunDefinition>;
};

/* --------------------------------------------------------------------------
 * Hook
 * ------------------------------------------------------------------------ */

// RF nodes carry an optional `selected` flag the pure graph type omits; the two
// are structurally identical otherwise, so the canvas node widens it locally.
// Exported so the pure reconciler is unit-testable with realistic shapes.
export type CanvasNode = WorkflowCanvasNode & { selected?: boolean };

/** Reconcile React Flow node state to the canonical step array through the
 *  `stepsToNodes` PROJECTION (plan §7 / v2_independent_input_nodes): the hidden
 *  singleton `user_input` step is never a node, each of its parameters expands
 *  into one independent virtual input node, and Ingredients-to-Image renders via
 *  the canvas-only variant marker. Pure: returns the next node array given the
 *  previous RF nodes, preserving each existing node's RF-managed public fields
 *  (measured / width / height / dragging, …) and canvas-owned position/selection
 *  while replacing the canonical data. New nodes take a requested pending
 *  position, else the projection's deterministic fallback. Validation applies to
 *  real (executable) nodes only; virtual input nodes carry `order: null` (no
 *  execution badge) and empty validation (singleton-level param issues surface in
 *  the global `validation.errors` list). Edges are NOT touched here — always
 *  re-derived from config refs by the caller. */
export function reconcileNodes(
  steps: WorkflowStep[],
  prev: CanvasNode[],
  validationByNode: Record<string, string[]>,
  pendingPositions: Map<string, XYPosition>,
  ingredientsVariants?: Record<string, ImageCanvasVariant>,
): CanvasNode[] {
  const projected = stepsToNodes(steps, null, ingredientsVariants);
  const byId = new Map(prev.map((n) => [n.id, n]));
  return projected.map((node) => {
    const existing = byId.get(node.id);
    const position = existing?.position ?? pendingPositions.get(node.id) ?? node.position;
    pendingPositions.delete(node.id);
    // Virtual input nodes are projections of the hidden singleton: no executable
    // order and no per-node validation (the singleton has no RF node).
    const isVirtualInput = node.data.order === null;
    const validation = isVirtualInput ? [] : (validationByNode[node.data.stepId] ?? []);
    // Spread the existing node FIRST to keep RF's measured/width/height/dragging,
    // then overwrite the canonical fields the draft owns.
    return {
      ...existing,
      id: node.id,
      type: node.type,
      position,
      selected: existing?.selected ?? false,
      data: { ...node.data, validation },
    } satisfies CanvasNode;
  });
}

export function useWorkflowCanvas(initial?: Partial<WorkflowDraft> & { steps?: unknown }): UseWorkflowCanvasReturn {
  const editor = useWorkflowEditor(initial);
  const { screenToFlowPosition: rfScreenToFlowPosition } = useReactFlow<CanvasNode, WorkflowCanvasEdge>();

  // Saved layout is read once for the initial workflow id; unsaved workflows get null.
  const [savedLayout] = useState<SavedLayout | null>(() => {
    const id = initial?.id;
    if (!id) return null;
    return readSavedLayout(String(id), editor.draft.definition.steps);
  });

  // Seed RF node state once from the draft + saved layout.
  const [initialNodes] = useState<CanvasNode[]>(() => stepsToNodes(editor.draft.definition.steps, savedLayout));
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowCanvasEdge>([]);

  // Requested positions for newly added nodes (drag-and-drop / tap), consumed on
  // first reconcile so dragging later updates the live node position instead.
  const pendingPositions = useRef<Map<string, XYPosition>>(new Map());
  // Latest nodes for layout persistence inside async save (avoids stale closures).
  // Updated in an effect (React 19 forbids writing refs during render).
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Canvas-only Ingredients-to-Image variant markers (keyed by step id). Never
  // serialized into the backend DTO; inferred on reload from a non-empty
  // capability-gated `input_images`, retained through config updates, and cleared
  // only when the step is deleted. A marked step with no `input_images` edge is
  // save-blocking until connected (v2_independent_input_nodes).
  const [ingredientsVariants, setIngredientsVariants] = useState<Record<string, ImageCanvasVariant>>({});
  const dropVariant = useCallback((id: string) => {
    setIngredientsVariants((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>(() => savedLayout?.viewport ?? { x: 0, y: 0, zoom: 1 });
  // Dirty baseline: snapshot the initial draft; refreshed after a successful save.
  const [baseline, setBaseline] = useState<string>(() => serializeDraftForDirty(editor.draft));

  const modelCapability = useMemo<ModelCapabilityMap>(
    () => buildModelCapabilityMap([...MODEL_IMAGE_INPUT_CAPABILITIES.keys()]),
    [],
  );

  const validation = useMemo(() => {
    const base = validateWorkflow(editor.draft.definition.steps, { modelCapability });
    // Ingredients-to-Image save-block: a canvas-only variant with no connected
    // image input is not savable (validateWorkflow cannot see the canvas variant).
    const ing = ingredientsValidation(editor.draft.definition.steps, ingredientsVariants);
    if (ing.errors.length === 0) return base;
    const byNode = { ...base.byNode };
    for (const [id, msgs] of Object.entries(ing.byNode)) (byNode[id] ??= []).push(...msgs);
    return { ok: false, errors: [...base.errors, ...ing.errors], byNode };
  }, [editor.draft.definition.steps, modelCapability, ingredientsVariants]);

  const steps = editor.draft.definition.steps;

  /* Reconcile RF state to the canonical draft whenever it changes, projecting
   * through stepsToNodes (hidden singleton + virtual input nodes + Ingredients
   * variant). Positions are preserved from the existing node (so drags survive
   * config edits) and each existing node's RF-managed fields (measured / width /
   * height / dragging) are kept while the canonical data/position/selection is
   * replaced. Edges are always fully re-derived from config refs. */
  useEffect(() => {
    setNodes((prev) => reconcileNodes(steps, prev, validation.byNode, pendingPositions.current, ingredientsVariants));
    setEdges(stepsToEdges(steps));
  }, [steps, validation, ingredientsVariants, setNodes, setEdges]);

  const currentSelectedStepId = useMemo(
    () => nodes.find((n) => n.selected)?.id ?? null,
    [nodes],
  );

  const selectStep = useCallback(
    (id: string | null) => {
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
    },
    [setNodes],
  );

  const screenToFlowPosition = useCallback(
    (clientPosition: { x: number; y: number }) => rfScreenToFlowPosition(clientPosition),
    [rfScreenToFlowPosition],
  );

  const addNode = useCallback(
    (kind: CanvasAddKind | StepType, clientPosition?: { x: number; y: number }): string => {
      // v2 hides the singleton `user-input` from the palette; a legacy caller
      // passing it is a safe no-op (text-input/image-input are the v2 paths).
      if (kind === "user-input") return "";
      const flow = clientPosition ? rfScreenToFlowPosition(clientPosition) : undefined;
      // Virtual input kinds append one unique parameter to the hidden singleton.
      if (kind === "text-input" || kind === "image-input") {
        const paramType: InputParamType = kind === "image-input" ? "image" : "text";
        const { steps: next, virtualId } = addVirtualInputParam(steps, paramType);
        if (flow) pendingPositions.current.set(virtualId, flow);
        editor.replaceSteps(next);
        return virtualId;
      }
      // Ingredients-to-Image: an ordinary `image` backend step plus a canvas-only
      // variant marker (save-blocking until an image edge connects).
      if (kind === "ingredients-image") {
        const id = generateStepId("image", steps.map((s) => s.id));
        if (flow) pendingPositions.current.set(id, flow);
        setIngredientsVariants((prev) => ({ ...prev, [id]: "ingredients" }));
        editor.replaceSteps([...steps, makeNewStep("image", id)]);
        return id;
      }
      // Ordinary generated step (kind is a StepType excluding user-input).
      const id = generateStepId(kind, steps.map((s) => s.id));
      if (flow) pendingPositions.current.set(id, flow);
      editor.replaceSteps([...steps, makeNewStep(kind, id)]);
      return id;
    },
    [editor, steps, rfScreenToFlowPosition],
  );

  const connect = useCallback(
    (conn: CanvasConnection): ConnectionValidation => {
      // Dev-only structured logging: ids + reason only, never prompt/config/workflow payload.
      logConnectionEvent("attempt", conn);
      // Virtual source nodes project a hidden singleton param: normalize to the
      // backend singleton/output ONCE before validate/patch. The displayed edge
      // re-derives from config as a virtual source (stepsToEdges). Shared with the
      // editor's live isValidConnection gate — no double normalization.
      const effective = normalizeConnection(conn);
      const field = fieldForConnection(steps, effective);
      if (!field) {
        logConnectionEvent("reject", conn, `No reference field '${effective.targetHandle}'.`);
        return { ok: false, reason: `Target has no reference field '${effective.targetHandle}'.` };
      }
      const result = validateConnection({ steps, conn: effective, modelCapability });
      if (result.ok) {
        const target = steps.find((s) => s.id === effective.target);
        const patch = target ? connectionToConfigPatch(effective, field, target.config ?? {}) : null;
        if (patch) {
          editor.updateStepConfig(effective.target, { [patch.field]: patch.value } as Partial<ConfigValues>);
          logConnectionEvent("applied", conn);
        }
        return result;
      }
      if (result.requiresReorder) {
        const target = steps.find((s) => s.id === effective.target);
        const patch = target ? connectionToConfigPatch(effective, field, target.config ?? {}) : null;
        if (patch) {
          editor.replaceSteps(applyConnectionAndReorder(steps, patch));
          logConnectionEvent("applied", conn, "Execution order updated automatically.");
          return { ok: true };
        }
      }
      logConnectionEvent("reject", conn, result.reason);
      return result;
    },
    [editor, steps, modelCapability],
  );


  const disconnect = useCallback(
    (edge: WorkflowCanvasEdge) => {
      const target = steps.find((s) => s.id === edge.target);
      if (!target) return;
      const field = (STEP_FIELDS[target.type] ?? []).find(
        (f) => f.name === edge.targetHandle && (isScalarRefField(f) || isRefListField(f)),
      );
      if (!field) return;
      // A displayed edge whose source is a virtual node maps back to the backend
      // singleton/output so the matching config ref is removed (no implicit refs).
      const parsed = parseVirtualInputId(edge.source);
      const backendEdge = parsed ? { ...edge, source: parsed.singletonStepId, sourceHandle: parsed.output } : edge;
      const patch = removeEdgeToConfigPatch(backendEdge, field, target.config ?? {});
      if (patch) editor.updateStepConfig(edge.target, { [patch.field]: patch.value } as Partial<ConfigValues>);
    },
    [editor, steps],
  );

  const disconnectEdges = useCallback(
    (selectedEdges: WorkflowCanvasEdge[]) => {
      if (selectedEdges.length === 0) return;
      editor.replaceSteps(disconnectEdgesFromSteps(steps, selectedEdges));
    },
    [editor, steps],
  );

  const removeNode = useCallback(
    (id: string): DeleteGuard => {
      // Virtual input node: exact (singleton, output). Sibling outputs untouched.
      const parsed = parseVirtualInputId(id);
      if (parsed) {
        const dependents = dependentStepIdsForOutput(steps, parsed.singletonStepId, parsed.output);
        if (dependents.length > 0) return { blocked: true, dependents };
        editor.replaceSteps(removeVirtualInputParam(steps, parsed.singletonStepId, parsed.output));
        pendingPositions.current.delete(id);
        return { blocked: false, dependents: [] };
      }
      // Real node: unchanged downstream-dependency guard; clear an Ingredients marker.
      const dependents = dependentStepIds(steps, id);
      if (dependents.length > 0) return { blocked: true, dependents };
      if (ingredientsVariants[id]) dropVariant(id);
      editor.replaceSteps(steps.filter((s) => s.id !== id));
      pendingPositions.current.delete(id);
      return { blocked: false, dependents: [] };
    },
    [editor, steps, ingredientsVariants, dropVariant],
  );

  const forceRemoveNode = useCallback(
    (id: string) => {
      // Virtual input node: force-delete clears only that output's refs and removes
      // the matching param, leaving the (possibly empty) singleton.
      const parsed = parseVirtualInputId(id);
      if (parsed) {
        editor.replaceSteps(removeVirtualInputParam(steps, parsed.singletonStepId, parsed.output));
        pendingPositions.current.delete(id);
        return;
      }
      if (ingredientsVariants[id]) dropVariant(id);
      editor.replaceSteps(removeStepAndDownstreamRefs(steps, id));
      pendingPositions.current.delete(id);
    },
    [editor, steps, ingredientsVariants, dropVariant],
  );

  /** Wrap param edits. For a virtual node id, edit ONLY the matching singleton
   *  param: a rename that would collide with another param's normalized output is
   *  rejected (param unchanged); an accepted rename cascades dependent refs and
   *  migrates the live/pending position to the new stable virtual id. For a real
   *  step id, replace the full param list and cascade an isolated rename. */
  const updateInputParams = useCallback(
    (id: string, params: InputParam[]) => {
      const current = editor.draft.definition.steps;
      const parsed = parseVirtualInputId(id);
      if (parsed) {
        const { singletonStepId, output } = parsed;
        const singleton = current.find((s) => s.id === singletonStepId && s.type === "user-input");
        if (!singleton) return;
        const next = params[0];
        if (!next) return;
        const newOutput = normalizeParamOutputName(next.name);
        // Duplicate normalized output on a DIFFERENT param: reject (param unchanged).
        const clash = (singleton.inputParams ?? []).some(
          (p) => normalizeParamOutputName(p.name) === newOutput && normalizeParamOutputName(p.name) !== output,
        );
        if (clash) return;
        const replaced = current.map((s) => {
          if (s.id !== singletonStepId || s.type !== "user-input") return s;
          let matched = false;
          const inputParams = (s.inputParams ?? []).map((p) => {
            if (normalizeParamOutputName(p.name) === output) {
              matched = true;
              return next;
            }
            return p;
          });
          if (!matched) inputParams.push(next);
          return { ...s, inputParams };
        });
        const cascaded =
          newOutput && newOutput !== output ? cascadeParamRename(replaced, singletonStepId, output, newOutput) : replaced;
        editor.replaceSteps(cascaded);
        // Migrate live/pending position to the new stable virtual id.
        if (newOutput && newOutput !== output) {
          const oldId = virtualInputId(singletonStepId, output);
          const newId = virtualInputId(singletonStepId, newOutput);
          const live = nodesRef.current.find((n) => n.id === oldId);
          if (live) pendingPositions.current.set(newId, live.position);
          else if (pendingPositions.current.has(oldId))
            pendingPositions.current.set(newId, pendingPositions.current.get(oldId)!);
          pendingPositions.current.delete(oldId);
        }
        return;
      }
      const target = current.find((s) => s.id === id);
      const rename = target ? computeParamRename(target.inputParams ?? [], params) : null;
      const withParams = current.map((s) => (s.id === id ? { ...s, inputParams: params } : s));
      editor.replaceSteps(rename ? cascadeParamRename(withParams, id, rename.oldOutput, rename.newOutput) : withParams);
    },
    [editor],
  );

  /** Step-shape edits are routed through the editor; a virtual node id is a safe
   *  no-op (virtual nodes edit their singleton param via updateInputParams). */
  const updateStep = useCallback(
    (id: string, update: Partial<WorkflowStep>) => {
      if (isVirtualInputId(id)) return;
      editor.updateStep(id, update);
    },
    [editor],
  );

  const onViewportChange = useCallback((vp: Viewport) => setViewport(vp), []);

  const persistLayout = useCallback(() => {
    const id = editor.draft.id;
    if (!id) return; // saved workflows only — never write unsaved keys
    // Positions keyed by PROJECTED node ids (virtual id or real step id) so the
    // v2 hash + stepsToNodes restore either; never RF metadata.
    writeSavedLayout(
      id,
      editor.draft.definition.steps,
      nodesRef.current.map((n) => ({ stepId: n.id, position: n.position })),
      viewport,
    );
  }, [editor.draft.id, editor.draft.definition.steps, viewport]);

  const save = useCallback(async (): Promise<{ id: string }> => {
    setError(null);
    if (editor.validation.length || validation.errors.length) {
      const message = editor.validation[0] ?? validation.errors[0] ?? "Workflow is invalid.";
      setError(message);
      throw new Error(message);
    }
    setSaving(true);
    try {
      const result = await editor.save();
      const id = result.id || editor.draft.id || "";
      if (id)
        writeSavedLayout(
          id,
          editor.draft.definition.steps,
          nodesRef.current.map((n) => ({ stepId: n.id, position: n.position })),
          viewport,
        );
      // Re-baseline dirty against the post-save draft (editor latches id + normalized steps).
      setBaseline(serializeDraftForDirty(editor.draft));
      return { id };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Workflow save failed.";
      setError(message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [editor, validation, viewport]);

  const runDefinition = useMemo(() => buildRunDefinition(steps), [steps]);

  const dirty = serializeDraftForDirty(editor.draft) !== baseline;

  return {
    draft: editor.draft,
    validation,
    editorErrors: editor.validation,
    dirty,
    nodes: nodes as WorkflowCanvasNode[],
    edges,
    setNodes: setNodes as unknown as ReturnType<typeof useNodesState<WorkflowCanvasNode>>[1],
    onNodesChange,
    onEdgesChange,
    screenToFlowPosition,
    selectedStepId: currentSelectedStepId,
    selectStep,
    modelCapability,
    updateStep,
    updateStepConfig: editor.updateStepConfig,
    updateInputParams,
    setMeta: editor.setMeta,
    addNode,
    connect,
    disconnect,
    disconnectEdges,
    removeNode,
    forceRemoveNode,
    viewport,
    onViewportChange,
    persistLayout,
    save,
    saving,
    error,
    runDefinition,
  };
}
