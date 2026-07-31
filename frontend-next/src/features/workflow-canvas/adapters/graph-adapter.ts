/** Copyright 2026 Google LLC — Apache-2.0
 * Pure graph adapter: WorkflowStep[] <-> canvas nodes/edges, plus connect/
 * disconnect config patches. Backend step config refs are canonical; edges are
 * a derived view. Legacy `WorkflowStep.outputRef` and `inputs[].sourceStepId`
 * are intentionally IGNORED (plan §2: UI-only/dead state). No React Flow
 * metadata is read or produced.
 *
 * Forward-compatible with workstream C: when `StepFieldSpec.kind: "ref-list"`
 * and `ConfigValues` allowing `BackendInputRef[]` land concurrently, this
 * module already handles them via structural checks (no edit required). */
import type {
  BackendInputRef,
  ConfigValues,
  StepFieldSpec,
  StepOutputSpec,
} from "../../workflow-editor/hooks/step-configs";
import {
  STEP_FIELDS,
  STEP_OUTPUTS,
  maxImageInputsForModel,
} from "../../workflow-editor/hooks/step-configs";
import { normalizeParamOutputName } from "../../workflow-editor/hooks/identifiers";
import type { WorkflowStep } from "../../workflow-editor/types";
import {
  expandVirtualInputs,
  inferIngredientsVariant,
  sourceToVirtualId,
} from "./virtual-inputs";
import type { ImageCanvasVariant, VirtualInputDescriptor } from "./virtual-inputs";
import type {
  CanvasConnection,
  CanvasKind,
  ConfigPatch,
  ModelCapabilityMap,
  SavedLayout,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  XYPosition,
} from "../graph-types";

const LAYOUT_X_GAP = 280;
const LAYOUT_Y_GAP = 140;

/* --------------------------------- helpers -------------------------------- */

/** Scalar reference field (single incoming edge allowed). */
export function isScalarRefField(spec: StepFieldSpec): boolean {
  return spec.kind === "ref";
}

/** Ordered multi-reference field (multiple incoming edges). Forward-compatible:
 * returns false until workstream C adds `kind: "ref-list"`. */
export function isRefListField(spec: StepFieldSpec): boolean {
  return spec.kind === "ref-list";
}

/** Literal-or-ref field: a text/textarea slot that ALSO accepts a structured
 *  BackendInputRef (StepFieldSpec `acceptsRef`). Holds a literal value by
 *  default and becomes a single scalar ref only when connected. Distinct from
 *  declared `ref`/`ref-list` fields. Image-ingredient ref-list gating reuses the
 *  canonical `isModelGatedRefList` from step-configs (not duplicated here). */
export function isLiteralOrRefField(spec: StepFieldSpec): boolean {
  return spec.acceptsRef === true && (spec.kind === "text" || spec.kind === "textarea");
}

/** Defensively read a raw config slot without depending on `ConfigValues`
 * widening to arrays (workstream C may add `BackendInputRef[]`). */
function rawSlot(config: ConfigValues, field: string): unknown {
  return (config as Record<string, unknown>)[field];
}

/** Read a scalar ref value, accepting the idempotent `"stepId::output"` string
 * and the already-resolved `{step,output}` object forms (mirrors step-configs). */
export function scalarRefValueOf(config: ConfigValues, field: string): BackendInputRef | null {
  const raw = rawSlot(config, field);
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw) && "step" in raw && "output" in raw) {
    const r = raw as { step: unknown; output: unknown };
    if (typeof r.step === "string" && typeof r.output === "string" && r.step && r.output) {
      return { step: r.step, output: r.output };
    }
  }
  if (typeof raw === "string") {
    const sep = raw.indexOf("::");
    if (sep <= 0) return null;
    const step = raw.slice(0, sep);
    const output = raw.slice(sep + 2);
    return step && output ? { step, output } : null;
  }
  return null;
}

/** Read an ordered ref-list value; tolerant of missing/non-array/old scalar. */
export function refListValueOf(config: ConfigValues, field: string): BackendInputRef[] {
  const raw = rawSlot(config, field);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is BackendInputRef =>
      !!r &&
      typeof r === "object" &&
      !Array.isArray(r) &&
      "step" in r &&
      "output" in r &&
      typeof (r as { step: unknown }).step === "string" &&
      typeof (r as { output: unknown }).output === "string",
  );
}

/** Whole-string reference pattern for loose inline refs in free-text fields
 *  (prompt templating). Strict on purpose so ordinary prose never matches. */
const LOOSE_REF_PATTERN = /^[A-Za-z][A-Za-z0-9_]*::[A-Za-z][A-Za-z0-9_]*$/;

/** Read a literal-or-ref slot. Accepts the canonical structured BackendInputRef
 *  written by `connectionToConfigPatch` and the legacy exact `step::output`
 *  string (strict identifier form, backward-compat round-trip). Returns null for
 *  ordinary literal prose so a connected ref is never confused with text. */
export function literalOrRefValueOf(config: ConfigValues, field: string): BackendInputRef | null {
  const raw = rawSlot(config, field);
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return scalarRefValueOf(config, field);
  if (typeof raw === "string" && LOOSE_REF_PATTERN.test(raw)) return scalarRefValueOf(config, field);
  return null;
}

/** All ref values a field currently carries. Declared `ref`/`ref-list` fields are
 *  the canonical dependencies; free-text fields (prompt templating) also count as
 *  a dependency when their whole value is a single `step::output` reference, so
 *  the canvas can show, order, and cycle-check them. Returns [] otherwise. */
export function refsForField(config: ConfigValues, spec: StepFieldSpec): BackendInputRef[] {
  if (isScalarRefField(spec)) {
    const one = scalarRefValueOf(config, spec.name);
    return one ? [one] : [];
  }
  if (isRefListField(spec)) return refListValueOf(config, spec.name);
  if (isLiteralOrRefField(spec)) {
    const one = literalOrRefValueOf(config, spec.name);
    return one ? [one] : [];
  }
  if (spec.kind === "text" || spec.kind === "textarea") {
    const raw = rawSlot(config, spec.name);
    if (typeof raw === "string" && LOOSE_REF_PATTERN.test(raw)) {
      const ref = scalarRefValueOf(config, spec.name);
      return ref ? [ref] : [];
    }
  }
  return [];
}

/** Read an ordered ref-list accepting either a ConfigValues object or a bare
 *  BackendInputRef[] (e.g. a previous patch's `value`), so repeated connect /
 *  disconnect invocations dedupe without dropping earlier refs. */
function refListOf(currentConfig: ConfigValues | BackendInputRef[], field: string): BackendInputRef[] {
  return refListValueOf(
    Array.isArray(currentConfig) ? ({ [field]: currentConfig } as ConfigValues) : currentConfig,
    field,
  );
}

/** Outputs a step produces. Generated steps use STEP_OUTPUTS; user-input uses
 * dynamic param identifiers (consistent with transforms.paramsToOutputs and the
 * virtual-input node ids, so a digit-leading "1st Photo" compiles to the same
 * `input_1st_photo` output everywhere a ref resolves). */
export function outputSpecsFor(step: WorkflowStep): StepOutputSpec[] {
  if (step.type === "user-input") {
    return (step.inputParams ?? [])
      .map((p) => ({ name: normalizeParamOutputName(p.name), type: p.type }))
      .filter((o) => o.name.length > 0);
  }
  return STEP_OUTPUTS[step.type] ?? [];
}

/** Stable edge id. Distinct sources into the same target handle stay unique. */
export function edgeId(source: string, sourceHandle: string, target: string, targetHandle: string): string {
  return `${source}::${sourceHandle}__${target}::${targetHandle}`;
}

/* ----------------------- virtual-input projection ------------------------- */

/** Expand every `user-input` singleton into its virtual descriptors keyed by the
 *  singleton step id. The hidden singleton stays the single backend source of
 *  truth; each descriptor projects one run-time parameter as an independent
 *  canvas node (plan §7 / v2_independent_input_nodes). */
function buildSingletonDescriptors(steps: readonly WorkflowStep[]): Map<string, VirtualInputDescriptor[]> {
  const map = new Map<string, VirtualInputDescriptor[]>();
  for (const step of steps) {
    if (step.type === "user-input") map.set(step.id, expandVirtualInputs(step));
  }
  return map;
}

/** Resolve a backend ref's DISPLAY source node id: the matching virtual node id
 *  when the ref points at a projected singleton output, otherwise the raw step
 *  id. The underlying config ref is NEVER rewritten — only the canvas view source
 *  changes, so the config stays `{step: singletonStepId, output: normalizedOutput}`. */
function displaySourceOf(
  ref: BackendInputRef,
  singletonDescriptors: Map<string, VirtualInputDescriptor[]>,
): string {
  const descriptors = singletonDescriptors.get(ref.step);
  if (descriptors) {
    const virtualId = sourceToVirtualId(ref, descriptors);
    if (virtualId) return virtualId;
  }
  return ref.step;
}

/* --------------------------- steps -> nodes/edges ------------------------- */

/**
 * Derive canvas edges purely from backend config refs. One edge per resolved
 * BackendInputRef on a `ref`/`ref-list` field. Dangling refs (unknown source)
 * are skipped here and reported by validation. Legacy `outputRef`/`sourceStepId`
 * contribute nothing.
 *
 * A ref whose source is the hidden singleton `user_input` step is rewritten so the
 * DISPLAY source is the corresponding virtual node id; the underlying config ref
 * stays `{step: singletonStepId, output}` (backend singleton). A ref to a
 * singleton output that no parameter projects (e.g. a stale/deleted param) has no
 * virtual node, so the display source falls back to the singleton step id and
 * validation reports the missing output. */
export function stepsToEdges(steps: WorkflowStep[]): WorkflowCanvasEdge[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const singletonDescriptors = buildSingletonDescriptors(steps);
  const edges: WorkflowCanvasEdge[] = [];
  for (const target of steps) {
    const config = target.config ?? {};
    for (const field of STEP_FIELDS[target.type]) {
      const refs = refsForField(config, field);
      if (refs.length === 0) continue;
      const cardinality: "scalar" | "list" = isRefListField(field) ? "list" : "scalar";
      for (const r of refs) {
        const source = byId.get(r.step);
        const out = source ? outputSpecsFor(source).find((o) => o.name === r.output) : undefined;
        const refType = out?.type ?? field.refType ?? "text";
        const displaySource = displaySourceOf(r, singletonDescriptors);
        edges.push({
          id: edgeId(displaySource, r.output, target.id, field.name),
          source: displaySource,
          target: target.id,
          sourceHandle: r.output,
          targetHandle: field.name,
          refType,
          cardinality,
        });
      }
    }
  }
  return edges;
}

/**
 * Deterministic layout with no external dependency (plan §10): x by graph level
 * (longest dependency chain), y by stable node order within a column; isolated
 * generated nodes (no in/out dependencies) get a separate left lane. Cycles are
 * guarded so this never loops; cycle reporting is validation's job.
 *
 * Virtual input nodes projected from the hidden singleton are placed in a left
 * input lane (column 0) as roots; a generated node depending on one levels to the
 * right of it. Layout positions are keyed by canvas node id — a virtual node id
 * or a real step id — so saved layouts can restore either. The hidden singleton
 * step id itself is never positioned (it is not a node). */
export function deterministicLayout(steps: WorkflowStep[]): Map<string, XYPosition> {
  const singletonDescriptors = buildSingletonDescriptors(steps);
  const virtualIds: string[] = [];
  for (const descriptors of singletonDescriptors.values()) {
    for (const d of descriptors) virtualIds.push(d.id);
  }
  const realSteps = steps.filter((s) => s.type !== "user-input");
  const ids = new Set<string>([...virtualIds, ...realSteps.map((s) => s.id)]);

  const deps = new Map<string, Set<string>>();
  const hasOutgoing = new Set<string>();
  // Virtual input nodes are roots: they have no incoming dependencies.
  for (const id of virtualIds) deps.set(id, new Set());
  for (const step of realSteps) {
    const d = new Set<string>();
    for (const spec of STEP_FIELDS[step.type]) {
      for (const r of refsForField(step.config ?? {}, spec)) {
        const displaySource = displaySourceOf(r, singletonDescriptors);
        if (ids.has(displaySource)) {
          d.add(displaySource);
          hasOutgoing.add(displaySource);
        }
      }
    }
    deps.set(step.id, d);
  }

  const level = new Map<string, number>();
  const compute = (id: string, stack: Set<string>): number => {
    if (level.has(id)) return level.get(id)!;
    if (stack.has(id)) return 0; // cycle guard
    stack.add(id);
    let max = -1;
    for (const dep of deps.get(id) ?? []) max = Math.max(max, compute(dep, stack));
    stack.delete(id);
    const l = max + 1;
    level.set(id, l);
    return l;
  };
  for (const id of ids) compute(id, new Set());

  const virtualSet = new Set(virtualIds);
  const positions = new Map<string, XYPosition>();
  const counters = new Map<number, number>();
  for (const id of ids) {
    const l = level.get(id) ?? 0;
    const isVirtual = virtualSet.has(id);
    const isolated = !isVirtual && (deps.get(id)?.size ?? 0) === 0 && !hasOutgoing.has(id);
    const col = isVirtual ? 0 : isolated ? -1 : l;
    const idx = counters.get(col) ?? 0;
    counters.set(col, idx + 1);
    positions.set(id, { x: col * LAYOUT_X_GAP, y: idx * LAYOUT_Y_GAP });
  }
  return positions;
}

/** Resolve the canvas kind for a generated step. Only a `generate_image` step
 *  can render as the distinct Ingredients-to-Image variant: from an explicit
 *  optional UI variant override, or inferred on reload from a non-empty
 *  capability-gated `input_images` (empty stays save-blocking until connected).
 *  Every other step type stays an ordinary one-node-per-step node (no canvasKind). */
function canvasKindForStep(
  step: WorkflowStep,
  ingredientsVariants?: Record<string, ImageCanvasVariant>,
): CanvasKind | undefined {
  if (step.type !== "image") return undefined;
  const explicit = ingredientsVariants?.[step.id];
  if (explicit === "ingredients") return "ingredients-image";
  if (explicit === "image") return undefined;
  const model = typeof step.config?.model === "string" ? step.config.model : undefined;
  return inferIngredientsVariant(step.config ?? {}, step.type, model) === "ingredients"
    ? "ingredients-image"
    : undefined;
}

/**
 * Map steps to canvas nodes. The hidden singleton `user-input` step is NOT a node;
 * each of its run-time parameters is expanded into one independent virtual input
 * node (text-input / image-input) with a stable id and `data.stepId` pointing at
 * the backend singleton. Every other step maps one-to-one. Positions come from
 * `savedLayout` (keyed by any node id — real step id or virtual id) when present
 * (the storage layer already validated version/hash); otherwise the built-in
 * deterministic layout runs, which places virtual input roots in a left input
 * lane. `data.validation` starts empty (filled by a validation pass). The visible
 * executable `order` excludes the hidden singleton, and virtual input nodes carry
 * `order: null` (no execution badge).
 *
 * `ingredientsVariants` is an optional UI-only override of the Ingredients render
 * for `generate_image` steps (keyed by step id); when omitted the variant is
 * inferred from refs + model capability. No canvasKind/order/variant is ever
 * serialized into the backend step DTO. */
export function stepsToNodes(
  steps: WorkflowStep[],
  savedLayout?: SavedLayout | null,
  ingredientsVariants?: Record<string, ImageCanvasVariant>,
): WorkflowCanvasNode[] {
  const fallback = deterministicLayout(steps);
  const savedPositions = new Map((savedLayout?.nodes ?? []).map((n) => [n.stepId, n.position]));
  const nodes: WorkflowCanvasNode[] = [];

  // Virtual input nodes: one per user-input singleton parameter (singleton hidden).
  for (const singleton of steps) {
    if (singleton.type !== "user-input") continue;
    for (const d of expandVirtualInputs(singleton)) {
      nodes.push({
        id: d.id,
        type: "user-input",
        position: savedPositions.get(d.id) ?? fallback.get(d.id) ?? { x: 0, y: 0 },
        data: {
          stepId: singleton.id,
          stepType: "user-input",
          label: d.displayName,
          config: {},
          inputParams: [{ name: d.displayName, type: d.paramType }],
          validation: [],
          order: null,
          canvasKind: d.canvasKind === "image" ? "image-input" : "text-input",
        },
      });
    }
  }

  // Normal nodes: one per non-user-input step. Visible executable order skips the
  // hidden singleton (1-based among the remaining steps).
  let order = 0;
  for (const step of steps) {
    if (step.type === "user-input") continue;
    order++;
    nodes.push({
      id: step.id,
      type: step.type,
      position: savedPositions.get(step.id) ?? fallback.get(step.id) ?? { x: 0, y: 0 },
      data: {
        stepId: step.id,
        stepType: step.type,
        label: step.label,
        config: { ...step.config },
        inputParams: step.inputParams ? [...step.inputParams] : undefined,
        validation: [],
        order,
        canvasKind: canvasKindForStep(step, ingredientsVariants),
      },
    });
  }
  return nodes;
}

/* --------------------------- connect / disconnect ------------------------- */

/**
 * Build the config patch for a connect intent.
 * - Scalar `ref`: replace the field's value with the new BackendInputRef.
 *   The caller MUST have validated the scalar handle is currently empty (or
 *   equal) — scalar replacement without an explicit disconnect is rejected by
 *   `validateConnection`.
 * - `ref-list`: append the ref to the ordered list, deduping an existing
 *   identical (step,output) pair so the patch is idempotent.
 *
 * Returns null for non-reference fields.
 */
export function connectionToConfigPatch(
  conn: CanvasConnection,
  field: StepFieldSpec,
  currentConfig: ConfigValues | BackendInputRef[],
): ConfigPatch | null {
  if (isLiteralOrRefField(field)) {
    return { stepId: conn.target, field: field.name, value: { step: conn.source, output: conn.sourceHandle } };
  }
  if (!isScalarRefField(field) && !isRefListField(field)) return null;
  const ref: BackendInputRef = { step: conn.source, output: conn.sourceHandle };
  if (isScalarRefField(field)) {
    return { stepId: conn.target, field: field.name, value: ref };
  }
  const current = refListOf(currentConfig, field.name);
  const exists = current.some((r) => r.step === ref.step && r.output === ref.output);
  return { stepId: conn.target, field: field.name, value: exists ? current : [...current, ref] };
}

/**
 * Build the config patch for a disconnect.
 * - Scalar `ref`: clear the field ("" sentinel, consistent with step-configs
 *   `coerce` for unresolved refs).
 * - `ref-list`: remove ONLY the matching (source,output) item, preserving the
 *   order of the remaining items.
 *
 * Returns null for non-reference fields.
 */
export function removeEdgeToConfigPatch(
  edge: WorkflowCanvasEdge,
  field: StepFieldSpec,
  currentConfig: ConfigValues | BackendInputRef[],
): ConfigPatch | null {
  if (isLiteralOrRefField(field)) {
    return { stepId: edge.target, field: field.name, value: "" };
  }
  if (!isScalarRefField(field) && !isRefListField(field)) return null;
  if (isScalarRefField(field)) {
    return { stepId: edge.target, field: field.name, value: "" };
  }
  const next = refListOf(currentConfig, field.name).filter(
    (r) => !(r.step === edge.source && r.output === edge.sourceHandle),
  );
  return { stepId: edge.target, field: field.name, value: next };
}

/** Build a ModelCapabilityMap from per-model image-input limits. Each model
 *  advertises its own maximum via `maxImageInputsForModel` (0 => unsupported);
 *  no global limit is applied. Use this to materialize the explicit capability
 *  set `validateConnection`/`validateWorkflow` accept, derived from the same
 *  source as their fallback. */
export function buildModelCapabilityMap(models: readonly string[]): ModelCapabilityMap {
  const map: ModelCapabilityMap = {};
  for (const model of models) {
    const max = maxImageInputsForModel(model);
    map[model] = max > 0 ? { multiImageInput: true, maxImageInputs: max } : { multiImageInput: false };
  }
  return map;
}

/** Re-export for adapter consumers that want the canonical field list. */
export { STEP_FIELDS };
