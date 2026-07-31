/** Copyright 2026 Google LLC — Apache-2.0
 * Graph-core validation: cycles, connection type/cardinality/capability,
 * execution order, and the explicit stable topological reorder. Loosely-typed
 * (prompt-templating) refs participate in dependency/order/cycle checks
 * alongside declared ref/ref-list fields. */
import { expect, test } from "bun:test";

import type { WorkflowStep } from "../../workflow-editor/types";
import { buildModelCapabilityMap, isLiteralOrRefField } from "../adapters/graph-adapter";
import { STEP_FIELDS, isModelGatedRefList } from "../../workflow-editor/hooks/step-configs";
import {
  hasCycle,
  reorderStepsTopologically,
  validateConnection,
  validateExecutionOrder,
  validateWorkflow,
} from "../adapters/graph-validation";

const step = (id: string, type: WorkflowStep["type"], extra: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id,
  type,
  label: id,
  inputs: [{ mode: "fixed" }],
  ...extra,
});
const ui = (id: string, params: { name: string; type: "text" | "image" }[] = []): WorkflowStep =>
  step(id, "user-input", { inputParams: params });
const img = (id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => {
  const { config: extraConfig, ...rest } = extra;
  return step(id, "image", {
    ...rest,
    config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false, ...extraConfig },
  });
};
const txt = (id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => {
  const { config: extraConfig, ...rest } = extra;
  return step(id, "text", { ...rest, config: { prompt: "p", model: "m", temperature: 0.7, ...extraConfig } });
};
const edit = (id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => {
  const { config: extraConfig, ...rest } = extra;
  return step(id, "edit", {
    ...rest,
    config: { input_images: "", prompt: "sharpen", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false, ...extraConfig },
  });
};

const conn = (source: string, sourceHandle: string, target: string, targetHandle: string) => ({
  source,
  sourceHandle,
  target,
  targetHandle,
});

// --- cycles (declared refs + loose prompt refs) ---

test("hasCycle is false for a DAG and true for a declared-ref cycle", () => {
  const dag = [img("a"), edit("b", { config: { input_images: [{ step: "a", output: "generated_image" }] } })];
  expect(hasCycle(dag)).toBe(false);

  const cycle = [
    edit("a", { config: { input_images: [{ step: "b", output: "generated_image" }] } }),
    img("b", { config: { input_images: [{ step: "a", output: "edited_image" }] } }),
  ];
  expect(hasCycle(cycle)).toBe(true);
});

test("hasCycle detects a cycle through a loose prompt ref", () => {
  const cycle = [
    txt("t1", { config: { prompt: "t2::generated_text" } }),
    txt("t2", { config: { prompt: "t1::generated_text" } }),
  ];
  expect(hasCycle(cycle)).toBe(true);
});

// --- execution order ---

test("validateExecutionOrder flags a source that runs after its target", () => {
  const ordered = [img("a"), edit("b", { config: { input_images: [{ step: "a", output: "generated_image" }] } })];
  expect(validateExecutionOrder(ordered).ok).toBe(true);

  const reversed = [edit("b", { config: { input_images: [{ step: "a", output: "generated_image" }] } }), img("a")];
  const res = validateExecutionOrder(reversed);
  expect(res.ok).toBe(false);
  expect(res.violations).toEqual([{ source: "a", target: "b" }]);
});

test("validateExecutionOrder considers loose prompt refs as dependencies", () => {
  const steps = [txt("t", { config: { prompt: "u::prompt" } }), ui("u", [{ name: "prompt", type: "text" }])];
  const res = validateExecutionOrder(steps);
  expect(res.ok).toBe(false);
  expect(res.violations).toEqual([{ source: "u", target: "t" }]);
});

// --- connection validation: type / cardinality / capability / order ---

test("validateConnection rejects a type mismatch", () => {
  const steps = [txt("gen_t"), edit("edit_1")];
  const res = validateConnection({ steps, conn: conn("gen_t", "generated_text", "edit_1", "input_images") });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/type mismatch/i);
});

test("validateConnection rejects a second source into an occupied scalar handle", () => {
  const steps = [
    img("gen_a"),
    img("gen_b"),
    step("vto_1", "vto", { config: { model_image: "gen_a::generated_image" } }),
  ];
  const res = validateConnection({ steps, conn: conn("gen_b", "generated_image", "vto_1", "model_image") });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/already connected|disconnect/i);
});

test("validateConnection rejects an identical duplicate scalar connection", () => {
  const steps = [img("gen_a"), step("vto_1", "vto", { config: { model_image: "gen_a::generated_image" } })];
  const res = validateConnection({ steps, conn: conn("gen_a", "generated_image", "vto_1", "model_image") });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/already exists/i);
});

test("validateConnection rejects a duplicate ref-list entry", () => {
  const steps = [
    img("gen_a"),
    img("gen_b", { config: { input_images: [{ step: "gen_a", output: "generated_image" }] } }),
  ];
  const res = validateConnection({ steps, conn: conn("gen_a", "generated_image", "gen_b", "input_images") });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/already exists/i);
});

test("validateConnection rejects a ref-list connect when the model lacks capability", () => {
  const steps = [img("gen_a"), img("gen_b", { config: { model: "gemini-2.0-flash", input_images: [] } })];
  const res = validateConnection({ steps, conn: conn("gen_a", "generated_image", "gen_b", "input_images") });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/does not support/i);
});

test("validateConnection rejects a ref-list connect at the model maximum", () => {
  const steps = [
    img("gen_a"),
    img("gen_b"),
    img("gen_c"),
    img("sink", {
      config: {
        model: "gemini-2.5-flash-image",
        input_images: [
          { step: "gen_a", output: "generated_image" },
          { step: "gen_b", output: "generated_image" },
        ],
      },
    }),
  ];
  const res = validateConnection({
    steps,
    conn: conn("gen_c", "generated_image", "sink", "input_images"),
    modelCapability: buildModelCapabilityMap(["gemini-2.5-flash-image"]),
  });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/maximum of 2/i);
});

test("validateConnection reports requiresReorder when the source runs after the target", () => {
  const steps = [img("sink", { config: { model: "gemini-3.1-flash-image", input_images: [] } }), img("gen_a")];
  const res = validateConnection({ steps, conn: conn("gen_a", "generated_image", "sink", "input_images") });
  expect(res.ok).toBe(false);
  expect(res.requiresReorder).toBe(true);
});

test("validateConnection accepts a valid ref-list append", () => {
  const steps = [img("gen_a"), img("sink", { config: { model: "gemini-3.1-flash-image", input_images: [] } })];
  const res = validateConnection({ steps, conn: conn("gen_a", "generated_image", "sink", "input_images") });
  expect(res.ok).toBe(true);
});

// --- workflow validation ---

test("validateWorkflow requires exactly one user-input step", () => {
  const res = validateWorkflow([img("a")]);
  expect(res.ok).toBe(false);
  expect(res.errors.some((e) => /exactly one user-input/i.test(e))).toBe(true);
});

test("validateWorkflow flags a type mismatch on a declared ref", () => {
  const steps = [
    ui("u", [{ name: "prompt", type: "text" }]),
    txt("t"),
    edit("e", { config: { input_images: [{ step: "t", output: "generated_text" }] } }),
  ];
  const res = validateWorkflow(steps);
  expect(res.ok).toBe(false);
  expect(res.byNode.e?.some((m) => /type mismatch/i.test(m))).toBe(true);
});

test("validateWorkflow flags a ref-list capability overflow", () => {
  const steps = [
    ui("u", [{ name: "prompt", type: "text" }]),
    img("a"),
    img("b"),
    img("c"),
    img("sink", {
      config: {
        model: "gemini-2.5-flash-image",
        input_images: [
          { step: "a", output: "generated_image" },
          { step: "b", output: "generated_image" },
          { step: "c", output: "generated_image" },
        ],
      },
    }),
  ];
  const res = validateWorkflow(steps, { modelCapability: buildModelCapabilityMap(["gemini-2.5-flash-image"]) });
  expect(res.ok).toBe(false);
  expect(res.byNode.sink?.some((m) => /exceed maximum of 2/i.test(m))).toBe(true);
});

test("validateWorkflow passes a valid workflow", () => {
  const steps = [
    ui("u", [{ name: "prompt", type: "text" }]),
    img("a"),
    edit("e", { config: { input_images: [{ step: "a", output: "generated_image" }], prompt: "sharpen" } }),
  ];
  expect(validateWorkflow(steps).ok).toBe(true);
});

test("validateWorkflow accepts a human-readable param display name (save no longer requires pre-normalization)", () => {
  // 'Text Input 1' normalizes to 'text_input_1' (non-digit-leading, no prefix).
  // Display name need not equal the normalized output; save-time normalize is canonical.
  const steps = [ui("u", [{ name: "Text Input 1", type: "text" }])];
  const res = validateWorkflow(steps);
  expect(res.ok).toBe(true);
  expect(res.byNode.u).toBeUndefined();
});

test("validateWorkflow flags duplicate parameter output names after normalization", () => {
  // 'Text Input' and 'text input' both normalize to 'text_input' -> duplicate.
  const steps = [ui("u", [{ name: "Text Input", type: "text" }, { name: "text input", type: "image" }])];
  const res = validateWorkflow(steps);
  expect(res.ok).toBe(false);
  expect(res.byNode.u?.some((m) => /duplicate parameter output name: 'text_input'/i.test(m))).toBe(true);
});

test("validateWorkflow leaves literal prompt prose unaffected by param normalization", () => {
  // A literal prompt (no '::' ref) coexisting with a human-readable param name
  // is never flagged; only nonblank + uniqueness-by-normalized-output are enforced.
  const steps = [
    ui("u", [{ name: "Text Input 1", type: "text" }]),
    txt("t", { config: { prompt: "a literal prompt with no ref" } }),
  ];
  const res = validateWorkflow(steps);
  expect(res.ok).toBe(true);
  expect(res.byNode.t?.some((m) => /normalize|empty|duplicate/i.test(m))).toBeFalsy();
});

// --- explicit stable topological reorder ---

test("reorderStepsTopologically moves dependencies before dependents", () => {
  const steps = [edit("edit_1", { config: { input_images: [{ step: "gen_a", output: "generated_image" }] } }), img("gen_a")];
  expect(reorderStepsTopologically(steps).map((s) => s.id)).toEqual(["gen_a", "edit_1"]);
});

test("reorderStepsTopologically preserves disconnected-node order (stable)", () => {
  const steps = [
    edit("edit_1", { config: { input_images: [{ step: "gen_a", output: "generated_image" }] } }),
    img("gen_a"),
    img("iso_y"),
    img("iso_x"),
  ];
  // gen_a before edit_1 (dependency); iso_y before iso_x (original-order tiebreak).
  expect(reorderStepsTopologically(steps).map((s) => s.id)).toEqual(["gen_a", "edit_1", "iso_y", "iso_x"]);
});

test("reorderStepsTopologically is a no-op when already ordered", () => {
  const steps = [img("gen_a"), edit("edit_1", { config: { input_images: "gen_a::generated_image" } })];
  expect(reorderStepsTopologically(steps).map((s) => s.id)).toEqual(["gen_a", "edit_1"]);
});

test("reorderStepsTopologically falls back to original order on a cycle", () => {
  const steps = [
    edit("a", { config: { input_images: "b::generated_image" } }),
    img("b", { config: { input_images: [{ step: "a", output: "edited_image" }] } }),
  ];
  // Caller must pre-validate; reorder never deadlocks and keeps original order.
  expect(reorderStepsTopologically(steps).map((s) => s.id)).toEqual(["a", "b"]);
});

// --- ModelCapabilityMap builder (per-model limits, no global cap) ---

test("buildModelCapabilityMap derives per-model limits from maxImageInputsForModel", () => {
  const cap = buildModelCapabilityMap(["gemini-2.5-flash-image", "gemini-3.1-flash-image", "gemini-2.0-flash"]);
  expect(cap["gemini-2.5-flash-image"]).toEqual({ multiImageInput: true, maxImageInputs: 2 });
  expect(cap["gemini-3.1-flash-image"]).toEqual({ multiImageInput: true, maxImageInputs: 14 });
  expect(cap["gemini-2.0-flash"]).toEqual({ multiImageInput: false });
});

// --- forward-compat metadata wiring (acceptsRef / refListCapability) ---

test("image/edit input_images ref-lists are model-gated; text/video generic lists are not", () => {
  const find = (t: WorkflowStep["type"], n: string) => STEP_FIELDS[t].find((f) => f.name === n)!;
  expect(isModelGatedRefList(find("image", "input_images"))).toBe(true);
  expect(isModelGatedRefList(find("edit", "input_images"))).toBe(true);
  expect(isModelGatedRefList(find("text", "input_images"))).toBe(false);
  expect(isModelGatedRefList(find("text", "input_videos"))).toBe(false);
  expect(isModelGatedRefList(find("video", "input_images"))).toBe(false);
});

test("prompt fields are literal-or-ref (acceptsRef): user-input text connects into them", () => {
  for (const stepType of ["text", "image", "edit", "video", "audio"] as WorkflowStep["type"][]) {
    const prompt = STEP_FIELDS[stepType].find((f) => f.name === "prompt")!;
    expect(isLiteralOrRefField(prompt), stepType).toBe(true);
    expect(prompt.refType).toBe("text");
  }
  // A settings text field is NOT literal-or-ref.
  expect(isLiteralOrRefField(STEP_FIELDS.text.find((f) => f.name === "model")!)).toBe(false);
});
