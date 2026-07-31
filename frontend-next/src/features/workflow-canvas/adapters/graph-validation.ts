/** Copyright 2026 Google LLC — Apache-2.0
 * Pure graph-core validation: cycle detection, single-connection validation
 * (type/cardinality/capability/order/cycle), save-blocking workflow validation,
 * dependency-order validation, and stable topological reorder.
 *
 * Save NEVER reorders. A valid connection whose source currently follows its
 * target is patched and reordered automatically by the canvas connect path.
 *
 * Source of truth: backend step config refs. Legacy `WorkflowStep.outputRef` and
 * `inputs[].sourceStepId` contribute nothing.
 *
 * See Serena memory `migration_nextjs/workflow_canvas_reactflow/plan` §8–§9. */
import { STEP_ID_PATTERN, isIdentifierSafe, normalizeParamOutputName } from "../../workflow-editor/hooks/identifiers";
import { STEP_FIELDS, isModelGatedRefList, modelSupportsImageReferences } from "../../workflow-editor/hooks/step-configs";
import type { WorkflowStep } from "../../workflow-editor/types";
import {
  isLiteralOrRefField,
  isRefListField,
  isScalarRefField,
  literalOrRefValueOf,
  outputSpecsFor,
  refListValueOf,
  refsForField,
  scalarRefValueOf,
} from "./graph-adapter";
import type {
  CanvasConnection,
  ConnectionValidation,
  ModelCapabilityMap,
  ValidationResult,
} from "../graph-types";

/* ---------------------------------- types --------------------------------- */

const SUPPORTED_STEP_TYPES = new Set<WorkflowStep["type"]>([
  "user-input",
  "text",
  "image",
  "edit",
  "video",
  "vto",
  "audio",
]);

type Adjacency = Map<string, Set<string>>;

/* ------------------------------ dependency map ---------------------------- */

/** Build target -> source-set adjacency purely from declared ref/ref-list config.
 *  Unknown source steps are skipped (validation surfaces them). */
function dependencyAdjacency(steps: WorkflowStep[]): Adjacency {
  const ids = new Set(steps.map((s) => s.id));
  const adj: Adjacency = new Map();
  for (const s of steps) adj.set(s.id, new Set());
  for (const target of steps) {
    const config = target.config ?? {};
    for (const field of STEP_FIELDS[target.type]) {
      for (const r of refsForField(config, field)) if (ids.has(r.step)) adj.get(target.id)!.add(r.step);
    }
  }
  return adj;
}

/* ------------------------------- cycle check ------------------------------ */

/** DFS cycle detection (3-color). True if the dependency graph has any cycle. */
export function hasCycle(steps: WorkflowStep[]): boolean {
  const adj = dependencyAdjacency(steps);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adj.keys()) color.set(id, WHITE);

  const visit = (u: string): boolean => {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v);
      if (c === GRAY) return true;
      if (c === WHITE && visit(v)) return true;
    }
    color.set(u, BLACK);
    return false;
  };

  for (const id of adj.keys()) if (color.get(id) === WHITE && visit(id)) return true;
  return false;
}

/** Would adding `conn` introduce a cycle? Builds current adjacency, adds the
 *  proposed edge, and re-runs DFS. Self-edge counts as a cycle. */
function wouldCreateCycle(steps: WorkflowStep[], conn: CanvasConnection): boolean {
  if (conn.source === conn.target) return true;
  const adj = dependencyAdjacency(steps);
  adj.get(conn.target)?.add(conn.source);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adj.keys()) color.set(id, WHITE);
  const visit = (u: string): boolean => {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v);
      if (c === GRAY) return true;
      if (c === WHITE && visit(v)) return true;
    }
    color.set(u, BLACK);
    return false;
  };
  for (const id of adj.keys()) if (color.get(id) === WHITE && visit(id)) return true;
  return false;
}

/* --------------------------- execution-order ------------------------------ */

export type ExecutionOrderResult = {
  ok: boolean;
  violations: Array<{ source: string; target: string }>;
};

/**
 * Verify every config-derived edge has its source earlier in the array than its
 * target. Backend executes by array index, so any violation blocks save. Save
 * never reorders to satisfy this; only an explicit user-confirmed call to
 * `reorderStepsTopologically` may.
 */
export function validateExecutionOrder(steps: WorkflowStep[]): ExecutionOrderResult {
  const index = new Map(steps.map((s, i) => [s.id, i]));
  const ids = new Set(steps.map((s) => s.id));
  const violations: Array<{ source: string; target: string }> = [];
  for (const target of steps) {
    const config = target.config ?? {};
    for (const field of STEP_FIELDS[target.type]) {
      for (const r of refsForField(config, field)) {
        if (!ids.has(r.step)) continue; // unknown source handled elsewhere
        if ((index.get(r.step) ?? 0) > (index.get(target.id) ?? 0)) {
          violations.push({ source: r.step, target: target.id });
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/* --------------------------- connection check ----------------------------- */

/**
 * Validate one connect intent against plan §8 rules:
 *  - reject self-edge;
 *  - reject unknown source/target/output/handle;
 *  - reject output-type mismatch with the target field `refType`;
 *  - reject cycles;
 *  - scalar handle: reject if already connected to a different source, and
 *    reject identical duplicates (no implicit replace);
 *  - ref-list handle: reject duplicates; reject when the selected model lacks
 *    multi-image capability; reject when at the capability maximum;
 *  - when source runs after target, return `requiresReorder: true` so the caller
 *    can apply the edge and run a stable topological reorder over the patched graph.
 */
export function validateConnection(args: {
  steps: WorkflowStep[];
  conn: CanvasConnection;
  modelCapability?: ModelCapabilityMap;
}): ConnectionValidation {
  const { steps, conn, modelCapability } = args;

  if (conn.source === conn.target) return { ok: false, reason: "Cannot connect a step to itself." };

  const source = steps.find((s) => s.id === conn.source);
  const target = steps.find((s) => s.id === conn.target);
  if (!source || !target) return { ok: false, reason: "Unknown source or target step." };

  const sourceOut = outputSpecsFor(source).find((o) => o.name === conn.sourceHandle);
  if (!sourceOut) return { ok: false, reason: `Source step has no output '${conn.sourceHandle}'.` };

  const targetField = (STEP_FIELDS[target.type] ?? []).find(
    (f) => f.name === conn.targetHandle && (isScalarRefField(f) || isRefListField(f) || isLiteralOrRefField(f)),
  );
  if (!targetField) return { ok: false, reason: `Target has no reference field '${conn.targetHandle}'.` };

  if (targetField.refType && targetField.refType !== sourceOut.type) {
    return { ok: false, reason: `Type mismatch: source is ${sourceOut.type}, target expects ${targetField.refType}.` };
  }

  if (wouldCreateCycle(steps, conn)) return { ok: false, reason: "Connection would create a cycle." };

  if (isScalarRefField(targetField) || isLiteralOrRefField(targetField)) {
    // Scalar typed target (declared ref or literal-or-ref). Single incoming edge
    // only; occupancy is checked against both the structured BackendInputRef and
    // the legacy exact `step::output` string so reconnects are never ambiguous.
    const existing = isLiteralOrRefField(targetField)
      ? literalOrRefValueOf(target.config ?? {}, targetField.name)
      : scalarRefValueOf(target.config ?? {}, targetField.name);
    if (existing) {
      const sameTarget = existing.step === conn.source && existing.output === conn.sourceHandle;
      return sameTarget
        ? { ok: false, reason: "Connection already exists." }
        : { ok: false, reason: "Scalar input is already connected. Disconnect it first." };
    }
  } else {
    // ref-list: duplicates are always rejected; capability/maximum gate applies
    // ONLY to image-ingredient lists. Generic media ref-lists accept multiple
    // refs with no model or global cap.
    const current = refListValueOf(target.config ?? {}, targetField.name);
    if (current.some((r) => r.step === conn.source && r.output === conn.sourceHandle)) {
      return { ok: false, reason: "Connection already exists." };
    }
    if (isModelGatedRefList(targetField)) {
      const model = typeof target.config?.model === "string" ? target.config.model : undefined;
      const cap = modelCapability?.[model ?? ""];
      const supported = cap ? cap.multiImageInput : modelSupportsImageReferences(model);
      if (!supported) {
        return { ok: false, reason: `Model '${model ?? ""}' does not support multi-image input.` };
      }
      if (cap?.maxImageInputs !== undefined && current.length >= cap.maxImageInputs) {
        return { ok: false, reason: `Maximum of ${cap.maxImageInputs} reference images reached.` };
      }
    }
  }

  const sourceIdx = steps.findIndex((s) => s.id === conn.source);
  const targetIdx = steps.findIndex((s) => s.id === conn.target);
  if (sourceIdx > targetIdx) {
    return {
      ok: false,
      reason: "Source step runs after target; execution order will update automatically.",
      requiresReorder: true,
    };
  }

  return { ok: true };
}

/* --------------------------- workflow validation -------------------------- */

/**
 * Save-blocking workflow validation (plan §9). Covers graph-level invariants
 * the backend cannot recover from: identifier-safe unique step ids, exactly one
 * user-input singleton, supported executor types, normalized+unique user-input
 * parameter names, every config ref resolves to a real source output, output
 * type matches the target `refType`, required scalar/ref-list fields present,
 * ref-list capability/maximum respected, no cycles, and dependency order.
 *
 * Workflow name presence is enforced at the editor layer (it owns the draft).
 */
export function validateWorkflow(
  steps: WorkflowStep[],
  options: { modelCapability?: ModelCapabilityMap } = {},
): ValidationResult {
  const errors: string[] = [];
  const byNode: Record<string, string[]> = {};
  const cap = options.modelCapability;
  const nodeError = (id: string, msg: string) => {
    (byNode[id] ??= []).push(msg);
  };

  // Duplicate + unsafe ids.
  const seenIds = new Set<string>();
  for (const s of steps) {
    if (seenIds.has(s.id)) {
      nodeError(s.id, "Duplicate step id.");
      errors.push(`Duplicate step id: ${s.id}.`);
    }
    seenIds.add(s.id);
    if (!STEP_ID_PATTERN.test(s.id)) nodeError(s.id, `Step id '${s.id}' is not identifier-safe.`);
  }

  // Exactly one user-input singleton.
  const userInput = steps.filter((s) => s.type === "user-input");
  if (userInput.length !== 1) {
    errors.push(`Exactly one user-input step is required (found ${userInput.length}).`);
    for (const s of userInput) nodeError(s.id, "Workflow must have exactly one user-input step.");
  }

  // Supported executor types only.
  for (const s of steps) {
    if (!SUPPORTED_STEP_TYPES.has(s.type)) nodeError(s.id, `Unsupported step type: ${s.type}.`);
  }

  // User-input parameter normalization + uniqueness.
  for (const s of steps) {
    if (s.type !== "user-input") continue;
    const seenOutputs = new Set<string>();
    for (const p of s.inputParams ?? []) {
      const normalized = normalizeParamOutputName(p.name);
      if (!normalized) {
        nodeError(s.id, "Parameter name is empty.");
        continue;
      }
      // Display name need not equal the normalized output; save-time
      // normalizeWorkflowIdentifiers remains canonical. Only nonblank +
      // uniqueness-by-normalized-output are enforced here.
      if (seenOutputs.has(normalized)) nodeError(s.id, `Duplicate parameter output name: '${normalized}'.`);
      seenOutputs.add(normalized);
    }
  }

  // First-occurrence lookup so duplicate ids surface only once-per-target.
  const byId = new Map<string, WorkflowStep>();
  for (const s of steps) if (!byId.has(s.id)) byId.set(s.id, s);

  // Every config ref resolves to a real source output with a compatible type.
  for (const target of steps) {
    const config = target.config ?? {};
    for (const field of STEP_FIELDS[target.type]) {
      const refs = refsForField(config, field);
      if (refs.length === 0) {
        // Required-presence is enforced for declared ref/ref-list fields and for
        // literal-or-ref fields (missing = no ref AND empty literal). Loose
        // prompt refs on plain free-text fields are optional templating, and
        // required free-text presence there stays the editor layer's job.
        if ((isScalarRefField(field) || isRefListField(field)) && field.required) {
          nodeError(target.id, `Missing required input: ${field.label}.`);
        } else if (isLiteralOrRefField(field) && field.required) {
          const v = (config as Record<string, unknown>)[field.name];
          const hasLiteral = typeof v === "string" ? v.trim().length > 0 : v != null;
          if (!hasLiteral) nodeError(target.id, `Missing required input: ${field.label}.`);
        }
        continue;
      }
      for (const r of refs) {
        const sourceStep = byId.get(r.step);
        if (!sourceStep) {
          nodeError(target.id, `${field.label}: unknown source step '${r.step}'.`);
          continue;
        }
        const out = outputSpecsFor(sourceStep).find((o) => o.name === r.output);
        if (!out) {
          nodeError(target.id, `${field.label}: source '${r.step}' has no output '${r.output}'.`);
          continue;
        }
        if (field.refType && out.type !== field.refType) {
          nodeError(target.id, `${field.label}: type mismatch (source ${out.type} vs expected ${field.refType}).`);
        }
      }
      // Image-ingredient ref-list capability + maximum (isModelGatedRefList).
      // Generic media ref-lists (text/video image+video fan-in) are not gated.
      if (isModelGatedRefList(field) && refs.length > 0) {
        const model = typeof config.model === "string" ? config.model : undefined;
        const mc = cap?.[model ?? ""];
        const supported = mc ? mc.multiImageInput : modelSupportsImageReferences(model);
        if (!supported) {
          nodeError(target.id, `${field.label}: model '${model ?? ""}' does not support multi-image input.`);
        }
        if (mc?.maxImageInputs !== undefined && refs.length > mc.maxImageInputs) {
          nodeError(target.id, `${field.label}: ${refs.length} inputs exceed maximum of ${mc.maxImageInputs}.`);
        }
      }
    }
  }

  // DAG only.
  if (hasCycle(steps)) errors.push("Workflow contains a cycle.");

  // Execution order must already be valid (save never reorders).
  const order = validateExecutionOrder(steps);
  if (!order.ok) {
    errors.push(`${order.violations.length} edge(s) violate execution order.`);
    for (const v of order.violations) nodeError(v.target, `Dependency '${v.source}' runs after this step.`);
  }

  const nodeErrors = Object.values(byNode).flat();
  return { ok: errors.length === 0 && nodeErrors.length === 0, errors, byNode };
}

/* ------------------------ topological reorder ----------------------------- */

/**
 * Stable topological reorder: every dependency appears before its dependent,
 * with original array index as the tie-breaker so disconnected/equal-priority
 * nodes retain their prior order. Cycles (caller must pre-validate) fall back
 * to original order so the operation never deadlocks.
 *
 * This is the ONLY function that reorders steps. Save and ordinary edits must
 * never call it. Plan §9.
 */
export function reorderStepsTopologically(steps: WorkflowStep[]): WorkflowStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const originalIndex = new Map(steps.map((s, i) => [s.id, i]));
  const incoming = new Map<string, Set<string>>();
  for (const s of steps) incoming.set(s.id, new Set());
  const ids = new Set(steps.map((s) => s.id));

  for (const target of steps) {
    const config = target.config ?? {};
    for (const field of STEP_FIELDS[target.type]) {
      for (const r of refsForField(config, field)) if (ids.has(r.step)) incoming.get(target.id)!.add(r.step);
    }
  }

  const placed = new Set<string>();
  const result: WorkflowStep[] = [];
  const remaining = () => steps.filter((s) => !placed.has(s.id));
  while (placed.size < steps.length) {
    const available = remaining()
      .filter((s) => {
        for (const dep of incoming.get(s.id) ?? []) if (!placed.has(dep)) return false;
        return true;
      })
      .sort((a, b) => (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0));
    if (available.length === 0) {
      // Cycle fallback: keep the rest in original order. Caller should have validated.
      for (const s of remaining()) result.push(s);
      break;
    }
    const next = available[0];
    result.push(byId.get(next.id)!);
    placed.add(next.id);
  }
  return result;
}

/* -------------------------------- exports --------------------------------- */

export { isIdentifierSafe };
