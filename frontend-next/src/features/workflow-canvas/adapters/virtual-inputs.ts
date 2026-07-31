/** Copyright 2026 Google LLC — Apache-2.0
 * Pure virtual-input helpers for the v2 independent-input-nodes canvas UX
 * (Serena memory `migration_nextjs/workflow_canvas_reactflow/v2_independent_input_nodes`).
 *
 * The single serialized backend `user_input` step is expanded into N independent
 * canvas nodes — one per run-time parameter. Edges drawn from a virtual node are
 * compiled back to `{step: singletonStepId, output: normalizedParamOutput}` so the
 * backend stays single-singleton. No backend canvas metadata is written; the view
 * re-expands on load from the step's `inputParams`.
 *
 * Pure: no React, no side effects, no React Flow import. */
import type {
  BackendInputRef,
  BackendInputValue,
  ConfigValues,
  RefType,
} from "../../workflow-editor/hooks/step-configs";
import {
  STEP_FIELDS,
  modelSupportsImageReferences,
  parseRefList,
} from "../../workflow-editor/hooks/step-configs";
import { isIdentifierSafe, normalizeParamOutputName } from "../../workflow-editor/hooks/identifiers";
import type { InputParamType, StepType, WorkflowStep } from "../../workflow-editor/types";

/* ------------------------------ identifiers ------------------------------- */

/** Separator between the singleton step id and the normalized param output.
 *  The whole virtual id stays identifier-safe (`^[A-Za-z][A-Za-z0-9_]*$`): both
 *  halves are identifier-safe, and a normalized param output never contains a
 *  double underscore, so this delimiter is unambiguous within the id. */
export const VIRTUAL_INPUT_DELIMITER = "__ui__";

function paramToRefType(type: InputParamType): RefType {
  return type === "image" ? "image" : "text";
}

/** Build the stable virtual canvas node id for one user-input parameter.
 *  `outputName` MUST be a normalized param output (`normalizeParamOutputName`),
 *  which never contains `__`, so the delimiter round-trips unambiguously. */
export function virtualInputId(singletonStepId: string, outputName: string): string {
  return `${singletonStepId}${VIRTUAL_INPUT_DELIMITER}${outputName}`;
}

/** Parse a virtual node id back to its singleton step id + normalized output.
 *  Splits on the LAST delimiter: a normalized output has no `__`, so the trailing
 *  segment is always the real output and any `__ui__` inside a (legacy) singleton
 *  id sits to the left of the true delimiter. Returns null for malformed ids. */
export function parseVirtualInputId(
  id: string,
): { singletonStepId: string; output: string } | null {
  const at = id.lastIndexOf(VIRTUAL_INPUT_DELIMITER);
  if (at <= 0) return null;
  const singletonStepId = id.slice(0, at);
  const output = id.slice(at + VIRTUAL_INPUT_DELIMITER.length);
  if (!output || !isIdentifierSafe(singletonStepId) || !isIdentifierSafe(output)) return null;
  return { singletonStepId, output };
}

export function isVirtualInputId(id: string): boolean {
  return parseVirtualInputId(id) !== null;
}

/** Resolve a virtual node id back to its backend source ref, or null if malformed. */
export function virtualIdToBackendRef(id: string): BackendInputRef | null {
  const parsed = parseVirtualInputId(id);
  return parsed ? { step: parsed.singletonStepId, output: parsed.output } : null;
}

/* ------------------------------- descriptors ------------------------------ */

export type VirtualInputKind = "text" | "image";

/** One independent virtual canvas node expanded from a user-input parameter. */
export interface VirtualInputDescriptor {
  /** Stable virtual canvas node id. */
  id: string;
  /** Backend singleton user_input step this node projects. */
  singletonStepId: string;
  /** Normalized backend output name (the compiled ref's `output`). */
  output: string;
  /** Human-facing display name (the parameter's stored name). */
  displayName: string;
  /** Canvas node kind, derived from the parameter type. */
  canvasKind: VirtualInputKind;
  /** Backend user_input output type (text|image). */
  paramType: InputParamType;
  /** Edge refType carried by this output, for connection validation. */
  refType: RefType;
}

/** Expand a user-input singleton into one virtual descriptor per parameter.
 *  Non user-input steps and blank/whitespace parameter names yield []. Order
 *  follows the step's `inputParams` (stable insertion order). Does NOT dedupe
 *  parameter collisions — identifier normalization/validation owns that; by the
 *  time a step is loaded its param output names are already unique. */
export function expandVirtualInputs(singleton: WorkflowStep): VirtualInputDescriptor[] {
  if (singleton.type !== "user-input") return [];
  const descriptors: VirtualInputDescriptor[] = [];
  for (const param of singleton.inputParams ?? []) {
    const output = normalizeParamOutputName(param.name);
    if (!output) continue;
    descriptors.push({
      id: virtualInputId(singleton.id, output),
      singletonStepId: singleton.id,
      output,
      displayName: param.name,
      canvasKind: param.type === "image" ? "image" : "text",
      paramType: param.type,
      refType: paramToRefType(param.type),
    });
  }
  return descriptors;
}

/* ----------------------------- ref <-> virtual ---------------------------- */

/** Map a backend ref source to its virtual display node id when it points at the
 *  singleton's matching parameter output; otherwise null (a normal step ref).
 *  `descriptors` is the expanded set for the singleton. */
export function sourceToVirtualId(
  ref: BackendInputRef,
  descriptors: readonly VirtualInputDescriptor[],
): string | null {
  for (const d of descriptors) {
    if (d.singletonStepId === ref.step && d.output === ref.output) return d.id;
  }
  return null;
}

/* --------------------- clear one singleton output ref -------------------- */

/** Remove/clear refs to exactly one singleton output from a raw config slot,
 *  leaving siblings untouched. Handles the three serialized shapes:
 *  - structured scalar `{step,output}` matching -> "" (cleared scalar sentinel);
 *  - ordered ref-list array -> filters out matching objects AND exact legacy
 *    `"step::output"` strings, preserving the order of the remaining items;
 *  - exact legacy `"step::output"` string -> "".
 *  Non-matching values are returned unchanged. */
export function clearSingletonOutputRef(
  value: BackendInputValue,
  singletonStepId: string,
  output: string,
): BackendInputValue {
  const isMatchObject = (v: unknown): boolean =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (v as { step?: unknown }).step === singletonStepId &&
    (v as { output?: unknown }).output === output;
  const legacyExact = `${singletonStepId}::${output}`;
  // `value` is typed `BackendInputRef[]`, but the legacy serialized form may mix
  // exact `"step::output"` strings into the array; widen the element to `unknown`
  // so the string check stays honest without widening the public value type.
  const isLegacyExact = (v: unknown): boolean => v === legacyExact;

  if (Array.isArray(value)) {
    return value.filter((item) => !isMatchObject(item) && !isLegacyExact(item));
  }
  if (isMatchObject(value)) return "";
  if (value === legacyExact) return "";
  return value;
}

/** Clear refs to one singleton output across EVERY slot of a config object,
 *  returning a shallow-copied config. Safe to run over all fields: the per-slot
 *  helper only mutates matching refs (structured scalar, ref-list entries, exact
 *  legacy `step::output` strings), so literals, checkboxes, and unrelated refs
 *  are returned unchanged. Covers acceptsRef prompt slots holding a whole-value
 *  ref to the removed output. */
export function clearSingletonOutputRefFromConfig(
  config: ConfigValues,
  singletonStepId: string,
  output: string,
): ConfigValues {
  const next: ConfigValues = {};
  for (const [key, value] of Object.entries(config)) {
    next[key] = clearSingletonOutputRef(value, singletonStepId, output) as ConfigValues[string];
  }
  return next;
}

/** Clear refs to one singleton output across one step's whole config. Pure:
 *  returns a new step object; steps without config are returned by-value
 *  unchanged. The singleton user_input step has no ref fields, so running this
 *  over every step in a workflow is a no-op on the singleton itself. */
export function clearSingletonOutputRefFromStep(
  step: WorkflowStep,
  singletonStepId: string,
  output: string,
): WorkflowStep {
  if (!step.config) return step;
  return { ...step, config: clearSingletonOutputRefFromConfig(step.config, singletonStepId, output) };
}

/** Clear refs to one singleton output across EVERY step in a workflow, returning a
 *  new step array. The exact-output cleanup the v2 virtual-input delete hook needs:
 *  it clears only the removed output's refs (structured scalar, ref-list entries,
 *  exact legacy `step::output` strings) and leaves every sibling output and every
 *  unrelated value untouched, so deleting one independent input node never drops
 *  edges that belong to its siblings. Pure. */
export function clearSingletonOutputRefFromWorkflow(
  steps: WorkflowStep[],
  singletonStepId: string,
  output: string,
): WorkflowStep[] {
  return steps.map((step) => clearSingletonOutputRefFromStep(step, singletonStepId, output));
}

/* ----------------------- ingredients variant inference ------------------- */

export type ImageCanvasVariant = "image" | "ingredients";

/** Infer the Ingredients-to-Image canvas variant for an image/edit step on reload:
 *  "ingredients" only when the model supports ordered image references AND
 *  `input_images` already carries at least one ref (so an empty Ingredients node
 *  stays save-blocking until connected). Data-driven via the STEP_FIELDS
 *  capability tag — only `image-ingredients` ref-lists are eligible. */
export function inferIngredientsVariant(
  config: ConfigValues,
  stepType: StepType,
  model: string | undefined | null,
): ImageCanvasVariant {
  const field = (STEP_FIELDS[stepType] ?? []).find((f) => f.name === "input_images");
  if (!field || field.refListCapability !== "image-ingredients") return "image";
  if (parseRefList(config.input_images).length === 0) return "image";
  return modelSupportsImageReferences(model) ? "ingredients" : "image";
}
