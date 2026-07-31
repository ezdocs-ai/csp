/** Copyright 2026 Google LLC — Apache-2.0
 * Identifier-safe step ID generation, atomic workflow identifier normalization,
 * and user-input parameter rename cascade. Pure — no React, no side effects.
 *
 * Backend stepId contract: ^[A-Za-z][A-Za-z0-9_]*$. Legacy/angular workflows may
 * carry UUIDs (hyphens) or other unsafe ids; normalizeWorkflowIdentifiers migrates
 * the edited definition atomically before save so the persisted contract is safe.
 */
import type { InputParam, StepType, WorkflowStep } from "../types";
import type { BackendInputRef, StepFieldSpec } from "./step-configs";
import { STEP_FIELDS, parseRefItem, parseRefList } from "./step-configs";
import { normalizeParamOutputName, toIdentifier } from "./transforms";

// Re-export the canonical param output normalizer so existing consumers (canvas adapters,
// hooks) keep their public import path without creating a runtime cycle: identifiers depends
// on transforms one-way only.
export { normalizeParamOutputName };

export const STEP_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function isIdentifierSafe(id: string): boolean {
  return STEP_ID_PATTERN.test(id);
}

const TYPE_PREFIX: Record<StepType, string> = {
  "user-input": "user_input",
  text: "text",
  image: "image",
  edit: "edit",
  video: "video",
  vto: "vto",
  audio: "audio",
};

function suffix(n: number): string {
  return n.toString(36);
}

/** Coerce an arbitrary id into a safe identifier, deduping against `used` (which it mutates). */
export function toSafeIdentifier(id: string, used: Set<string>): string {
  let base = id.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (base && !/^[A-Za-z]/.test(base)) base = `s_${base}`;
  if (!base) base = "step";
  let candidate = base;
  let n = 1;
  while (used.has(candidate)) candidate = `${base}_${suffix(n++)}`;
  used.add(candidate);
  return candidate;
}

/**
 * Deterministic-safe new step id: `<type>_<base36-timestamp>[_<counter>]`.
 * Never raw hyphenated UUID. Uniqueness guaranteed against `existingIds`.
 */
export function generateStepId(type: StepType, existingIds: Iterable<string>): string {
  const used = new Set(existingIds);
  const prefix = TYPE_PREFIX[type] ?? "step";
  const stamp = suffix(Date.now());
  let candidate = `${prefix}_${stamp}`;
  let n = 0;
  while (used.has(candidate)) candidate = `${prefix}_${stamp}_${suffix(++n)}`;
  return candidate;
}

function refFields(type: StepType, includePrompts = false): StepFieldSpec[] {
  return (STEP_FIELDS[type] ?? []).filter(
    (f) => f.kind === "ref" || f.kind === "ref-list" || (includePrompts && f.acceptsRef === true),
  );
}

type RefRewriter = (ref: BackendInputRef) => BackendInputRef;

/** Rewrite every ref under a step's config using `rewrite`.
 *  - scalar `ref` and `ref-list` fields are always covered;
 *  - when `includePrompts` is set, whole-value refs carried by `acceptsRef`
 *    text/textarea prompt fields are also rewritten (representation preserved:
 *    a `"step::output"` string stays a string, a structured ref stays structured).
 *  Literal prompt strings (no `::`) are never touched. */
function rewriteStepRefs(step: WorkflowStep, rewrite: RefRewriter, includePrompts = false): WorkflowStep {
  const fields = refFields(step.type, includePrompts);
  if (!step.config || fields.length === 0) return step;
  const config = { ...step.config };
  for (const field of fields) {
    if (field.kind === "ref-list") {
      const original = parseRefList(config[field.name]);
      if (original.length === 0) continue; // nothing serialized -> nothing to rewrite
      config[field.name] = original.map(rewrite);
    } else if (field.kind === "ref") {
      const ref = parseRefItem(config[field.name]);
      if (ref) config[field.name] = rewrite(ref);
    } else {
      // acceptsRef prompt field holding a whole-value ref; literals fall through untouched.
      const original = config[field.name];
      const ref = parseRefItem(original);
      if (!ref) continue;
      const next = rewrite(ref);
      config[field.name] = typeof original === "string" ? `${next.step}::${next.output}` : next;
    }
  }
  return { ...step, config };
}

/**
 * Atomically migrate a workflow definition to identifier-safe ids + refs.
 * - rewrites unsafe/colliding step ids, preserving array order;
 * - rewrites every serialized ref (scalar + ref-list) to the new source step id;
 * - normalizes user_input parameter output names (digit-prefixed) and cascades the
 *   output rename into every dependent ref.
 * Idempotent: a second pass over already-safe ids/refs is a no-op.
 */
export function normalizeWorkflowIdentifiers(steps: WorkflowStep[]): WorkflowStep[] {
  // 1. Resolve old -> safe step id, preserving array order and handling collisions.
  //    Resolved ids are positional; stepIdMap (original -> resolved) drives ref rewriting and is
  //    last-wins on literal duplicate original ids (real workflows have unique ids; legacy UUIDs
  //    are unique, so this only matters for pathological hand-authored collisions).
  const stepIdMap = new Map<string, string>();
  const usedIds = new Set<string>();
  const resolvedIds: string[] = [];
  for (const step of steps) {
    const resolved = toSafeIdentifier(step.id, usedIds);
    resolvedIds.push(resolved);
    stepIdMap.set(step.id, resolved);
  }

  // 2. Per user_input step (keyed by ORIGINAL id): old output -> normalized output.
  const outputMaps = new Map<string, Map<string, string>>();
  for (const step of steps) {
    if (step.type !== "user-input") continue;
    const outputs = new Map<string, string>();
    const seen = new Set<string>();
    for (const param of step.inputParams ?? []) {
      const oldOut = toIdentifier(param.name);
      let newOut = normalizeParamOutputName(param.name);
      // Guarantee uniqueness among this step's params (collision dedupe).
      let n = 1;
      while (newOut && seen.has(newOut)) newOut = `${normalizeParamOutputName(param.name)}_${suffix(n++)}`;
      if (newOut) seen.add(newOut);
      if (oldOut && newOut && oldOut !== newOut) outputs.set(oldOut, newOut);
    }
    if (outputs.size > 0) outputMaps.set(step.id, outputs);
  }

  const rewrite: RefRewriter = (ref) => {
    const step = stepIdMap.get(ref.step) ?? ref.step;
    const outputs = outputMaps.get(ref.step);
    const output = (outputs && outputs.get(ref.output)) || ref.output;
    return { step, output };
  };

  // 3. Apply: positional new ids, rewritten refs, normalized param display names.
  return steps.map((step, index) => {
    const renamed = rewriteStepRefs(step, rewrite);
    const inputParams =
      step.type === "user-input"
        ? (step.inputParams ?? []).map((p) => {
            const norm = normalizeParamOutputName(p.name);
            return { ...p, name: norm || p.name };
          })
        : step.inputParams;
    return { ...renamed, id: resolvedIds[index] ?? step.id, inputParams };
  });
}

/**
 * Cascade a user_input parameter output rename into every dependent ref across the workflow.
 * Rewrites scalar refs, ref-list entries, and whole-value prompt refs (declared acceptsRef
 * fields) whose {step, output} matches. Literal prompt prose is never touched and a ref's
 * representation (string "step::output" vs structured object) is preserved.
 * Idempotent: old === new short-circuits to the input array.
 */
export function cascadeParamRename(
  steps: WorkflowStep[],
  userInputStepId: string,
  oldOutput: string,
  newOutput: string,
): WorkflowStep[] {
  if (oldOutput === newOutput) return steps;
  const rewrite: RefRewriter = (ref) =>
    ref.step === userInputStepId && ref.output === oldOutput ? { step: ref.step, output: newOutput } : ref;
  return steps.map((step) => rewriteStepRefs(step, rewrite, true));
}

/** Build the identifier-safe empty user-input singleton (no params, fresh safe id). */
function makeSingletonUserInput(existingIds: string[]): WorkflowStep {
  return {
    id: generateStepId("user-input", existingIds),
    type: "user-input",
    label: "user input",
    inputs: [{ mode: "fixed" }],
    inputParams: [],
  };
}

/**
 * Guarantee exactly one user-input step at steps[0] (v2 singleton normalization). Pure, no params.
 * - absent  -> prepend an identifier-safe empty singleton;
 * - one elsewhere -> move it to steps[0] (non-input relative order preserved);
 * - many   -> keep the FIRST as primary, merge every secondary's params into it,
 *            drop the secondaries, and rewrite every dependent ref (scalar ref,
 *            ref-list, whole-value prompt ref) from each secondary id/output to
 *            the primary (output renamed on collision so no param is lost).
 * Merged parameter output names are normalized + deduped (collision-appended suffix)
 * without data loss; refs follow the rename. Idempotent: a second pass is a no-op.
 * Composes with normalizeWorkflowIdentifiers (run after this) for id-safety + output cascade.
 */
export function ensureSingleUserInputStep(steps: WorkflowStep[]): WorkflowStep[] {
  const inputIndices: number[] = [];
  for (let i = 0; i < steps.length; i++) if (steps[i].type === "user-input") inputIndices.push(i);

  if (inputIndices.length === 0) return [makeSingletonUserInput(steps.map((s) => s.id)), ...steps];
  if (inputIndices.length === 1 && inputIndices[0] === 0) return steps;

  const primary = steps[inputIndices[0]];
  const secondaries = inputIndices.slice(1).map((i) => steps[i]);
  const secondaryIds = new Set(secondaries.map((s) => s.id));

  // Merge params: primary first, then each secondary's params deduped against the taken set.
  const mergedParams: InputParam[] = [...(primary.inputParams ?? [])];
  const taken = new Set<string>();
  for (const p of mergedParams) {
    const o = normalizeParamOutputName(p.name);
    if (o) taken.add(o);
  }
  // secondary id -> (old output -> deduped new output)
  const outputRewrite = new Map<string, Map<string, string>>();
  for (const sec of secondaries) {
    const local = new Map<string, string>();
    for (const param of sec.inputParams ?? []) {
      const oldOutput = toIdentifier(param.name);
      let newOutput = normalizeParamOutputName(param.name);
      if (newOutput) {
        if (taken.has(newOutput)) {
          let n = 1;
          while (taken.has(`${newOutput}_${suffix(n)}`)) n++;
          newOutput = `${newOutput}_${suffix(n)}`;
        }
        taken.add(newOutput);
      }
      mergedParams.push({ name: newOutput || param.name, type: param.type });
      if (oldOutput && newOutput && oldOutput !== newOutput) local.set(oldOutput, newOutput);
    }
    if (local.size > 0) outputRewrite.set(sec.id, local);
  }

  const primaryId = primary.id;
  const rewrite: RefRewriter = (ref) => {
    if (!secondaryIds.has(ref.step)) return ref;
    const local = outputRewrite.get(ref.step);
    if (!local) return { step: primaryId, output: ref.output };
    // Legacy refs may carry the raw display name; match on identifier form too.
    const output = local.get(ref.output) ?? local.get(toIdentifier(ref.output)) ?? ref.output;
    return { step: primaryId, output };
  };

  const merged = { ...primary, inputParams: mergedParams };
  const rest = steps
    .filter((s) => s.type !== "user-input")
    .map((s) => rewriteStepRefs(s, rewrite, true));
  return [merged, ...rest];
}
