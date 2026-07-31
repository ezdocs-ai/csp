/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import type { WorkflowStep } from "../../types";
import {
  STEP_ID_PATTERN,
  cascadeParamRename,
  ensureSingleUserInputStep,
  generateStepId,
  isIdentifierSafe,
  normalizeParamOutputName,
  normalizeWorkflowIdentifiers,
  toSafeIdentifier,
} from "../identifiers";

const step = (
  id: string,
  type: WorkflowStep["type"],
  extra: Partial<WorkflowStep> = {},
): WorkflowStep => ({
  id,
  type,
  label: id,
  inputs: [{ mode: "fixed" }],
  ...extra,
});

// --- identifier-safe step id generator ---

test("isIdentifierSafe matches ^[A-Za-z][A-Za-z0-9_]*$", () => {
  expect(isIdentifierSafe("user_input")).toBe(true);
  expect(isIdentifierSafe("image_abc")).toBe(true);
  expect(isIdentifierSafe("A1_b2")).toBe(true);
  expect(isIdentifierSafe("123abc")).toBe(false);
  expect(isIdentifierSafe("has-hyphen")).toBe(false);
  expect(isIdentifierSafe("")).toBe(false);
});

test("generateStepId is identifier-safe and unique against existing ids", () => {
  const id = generateStepId("image", ["image_x", "text_y"]);
  expect(STEP_ID_PATTERN.test(id)).toBe(true);
  expect(id.startsWith("image_")).toBe(true);
  expect(id).not.toBe("image_x");
});

test("generateStepId disambiguates a timestamp collision", () => {
  const existing = [generateStepId("text", [])];
  const next = generateStepId("text", existing);
  expect(next).not.toBe(existing[0]);
  expect(STEP_ID_PATTERN.test(next)).toBe(true);
});

test("toSafeIdentifier coerces unsafe ids and dedupes collisions", () => {
  const used = new Set<string>();
  expect(toSafeIdentifier("user-1", used)).toBe("user_1");
  expect(toSafeIdentifier("123", used)).toBe("s_123");
  expect(toSafeIdentifier("!!!", used)).toBe("step");
  // Collision appends a suffix.
  expect(toSafeIdentifier("user_1", used)).toBe("user_1_1");
});

// --- parameter output name normalization ---

test("normalizeParamOutputName lower-snakes and prefixes leading digits", () => {
  // Re-exported from transforms.ts; verifies the public identifiers.ts path still resolves.
  expect(normalizeParamOutputName("Prompt")).toBe("prompt");
  expect(normalizeParamOutputName("User Image")).toBe("user_image");
  expect(normalizeParamOutputName("123")).toBe("input_123");
  expect(normalizeParamOutputName("1st Photo")).toBe("input_1st_photo");
  expect(normalizeParamOutputName("   ")).toBe("");
});

// --- atomic identifier normalization ---

test("normalizeWorkflowIdentifiers rewrites unsafe step ids and preserves order", () => {
  const steps = [step("111-aaa-bbb", "image"), step("user-1", "user-input")];
  const out = normalizeWorkflowIdentifiers(steps);
  expect(out.map((s) => s.id)).toEqual(["s_111_aaa_bbb", "user_1"]);
  // Order preserved.
  expect(out[0].type).toBe("image");
});

test("normalizeWorkflowIdentifiers cascades the id rename into scalar refs", () => {
  const steps = [
    step("user-1", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] }),
    step("img-1", "vto", { config: { model_image: "user-1::prompt" } }),
  ];
  const out = normalizeWorkflowIdentifiers(steps);
  expect(out[1].config).toMatchObject({ model_image: { step: "user_1", output: "prompt" } });
});

test("normalizeWorkflowIdentifiers cascades the id rename into ordered ref-lists", () => {
  const steps = [
    step("gen-1", "image", { config: { prompt: "x", input_images: [{ step: "gen-1", output: "generated_image" }] } }),
  ];
  // Self-reference is artificial but exercises the list rewrite path.
  const out = normalizeWorkflowIdentifiers(steps);
  expect(out[0].config?.input_images).toEqual([{ step: "gen_1", output: "generated_image" }]);
});

test("normalizeWorkflowIdentifiers normalizes user_input param output names (digit prefix) and cascades", () => {
  const steps = [
    step("ui", "user-input", { inputParams: [{ name: "123", type: "image" }] }),
    step("img", "image", { config: { prompt: "p", input_images: [{ step: "ui", output: "123" }] } }),
  ];
  const out = normalizeWorkflowIdentifiers(steps);
  expect(out[0].inputParams?.[0].name).toBe("input_123");
  expect(out[1].config?.input_images).toEqual([{ step: "ui", output: "input_123" }]);
});

test("normalizeWorkflowIdentifiers dedupes colliding ids while preserving order", () => {
  const steps = [step("dup", "text"), step("dup", "text")];
  const out = normalizeWorkflowIdentifiers(steps);
  expect(out.map((s) => s.id)).toEqual(["dup", "dup_1"]);
});

test("normalizeWorkflowIdentifiers is idempotent on already-safe ids/refs", () => {
  const steps = [
    step("ui", "user-input", { inputParams: [{ name: "prompt", type: "text" }] }),
    step("img", "vto", { config: { model_image: "ui::prompt" } }),
  ];
  const once = normalizeWorkflowIdentifiers(steps);
  const twice = normalizeWorkflowIdentifiers(once);
  expect(twice).toEqual(once);
});

// --- cascading parameter rename ---

test("cascadeParamRename rewrites scalar + ref-list entries pointing at the renamed output", () => {
  const steps = [
    step("ui", "user-input"),
    step("img", "image", {
      config: {
        prompt: "p",
        input_images: [{ step: "ui", output: "old" }, { step: "ui", output: "other" }, { step: "gen", output: "old" }],
      },
    }),
    step("v", "vto", { config: { model_image: "ui::old" } }),
  ];
  const out = cascadeParamRename(steps, "ui", "old", "new");
  expect(out[1].config?.input_images).toEqual([
    { step: "ui", output: "new" },
    { step: "ui", output: "other" },
    { step: "gen", output: "old" },
  ]);
  expect(out[2].config?.model_image).toEqual({ step: "ui", output: "new" });
});

test("cascadeParamRename is a no-op when old === new", () => {
  const steps = [step("ui", "user-input"), step("img", "image", { config: { prompt: "p", input_images: [{ step: "ui", output: "old" }] } })];
  expect(cascadeParamRename(steps, "ui", "old", "old")).toBe(steps);
});

test("cascadeParamRename rewrites whole-value prompt refs (string + object) and leaves literals/siblings untouched", () => {
  const steps = [
    step("ui", "user-input"),
    // Generate Text: prompt holds a whole-value ref in the legacy linear string form.
    step("txt", "text", { config: { prompt: "ui::old", input_images: [{ step: "ui", output: "other" }] } }),
    // Generate Image: prompt holds a whole-value ref as a structured object.
    step("img", "image", { config: { prompt: { step: "ui", output: "old" } } }),
  ];
  const out = cascadeParamRename(steps, "ui", "old", "new");
  // Retargeted, representation preserved (string stays string, object stays object).
  expect(out[1].config?.prompt).toBe("ui::new");
  expect(out[2].config?.prompt).toEqual({ step: "ui", output: "new" });
  // Sibling ref to a different output is untouched.
  expect(out[1].config?.input_images).toEqual([{ step: "ui", output: "other" }]);
});

test("cascadeParamRename leaves literal prompt prose untouched", () => {
  const steps = [
    step("ui", "user-input"),
    step("img", "image", { config: { prompt: "a literal prompt with no ref" } }),
  ];
  const out = cascadeParamRename(steps, "ui", "old", "new");
  expect(out[1].config?.prompt).toBe("a literal prompt with no ref");
});

// --- v2 singleton normalization: ensureSingleUserInputStep ---

test("ensureSingleUserInputStep prepends an identifier-safe empty singleton when no user-input exists", () => {
  const out = ensureSingleUserInputStep([step("img", "image")]);
  expect(out).toHaveLength(2);
  expect(out[0].type).toBe("user-input");
  expect(STEP_ID_PATTERN.test(out[0].id)).toBe(true);
  expect(out[0].id).not.toBe("img");
  expect(out[0].inputParams).toEqual([]);
  expect(out[1].id).toBe("img"); // non-input order preserved
});

test("ensureSingleUserInputStep moves a lone user-input not at index 0 to the front", () => {
  const ui = step("ui", "user-input", { inputParams: [{ name: "prompt", type: "text" }] });
  const out = ensureSingleUserInputStep([step("img", "image"), ui, step("txt", "text")]);
  expect(out.map((s) => s.id)).toEqual(["ui", "img", "txt"]); // ui promoted, others keep relative order
  expect(out[0].inputParams).toEqual([{ name: "prompt", type: "text" }]);
});

test("ensureSingleUserInputStep merges multiple user-input steps into the first, preserving non-input order", () => {
  const a = step("uiA", "user-input", { inputParams: [{ name: "alpha", type: "text" }] });
  const b = step("img", "image");
  const c = step("uiB", "user-input", { inputParams: [{ name: "beta", type: "image" }] });
  const d = step("txt", "text");
  const out = ensureSingleUserInputStep([a, b, c, d]);
  expect(out.map((s) => s.id)).toEqual(["uiA", "img", "txt"]);
  expect(out[0].inputParams).toEqual([
    { name: "alpha", type: "text" },
    { name: "beta", type: "image" },
  ]);
});

test("ensureSingleUserInputStep dedupes colliding merged output names without data loss", () => {
  const a = step("uiA", "user-input", { inputParams: [{ name: "prompt", type: "text" }] });
  const b = step("uiB", "user-input", { inputParams: [{ name: "Prompt", type: "image" }, { name: "unique", type: "text" }] });
  const out = ensureSingleUserInputStep([a, b]);
  expect(out).toHaveLength(1);
  expect(out[0].inputParams).toEqual([
    { name: "prompt", type: "text" },
    { name: "prompt_1", type: "image" },
    { name: "unique", type: "text" },
  ]);
});

test("ensureSingleUserInputStep rewrites scalar, ref-list, and whole-value prompt refs from secondary to primary (+renamed output)", () => {
  const a = step("uiA", "user-input", { inputParams: [{ name: "prompt", type: "text" }] });
  const b = step("uiB", "user-input", { inputParams: [{ name: "Prompt", type: "image" }] }); // collides -> prompt_1
  const img = step("img", "image", {
    config: {
      prompt: "uiB::Prompt", // whole-value prompt ref (string form)
      input_images: [{ step: "uiB", output: "Prompt" }], // ref-list
    },
  });
  const vto = step("vto", "vto", { config: { model_image: { step: "uiB", output: "Prompt" } } }); // scalar ref (object form)
  const out = ensureSingleUserInputStep([a, b, img, vto]);
  expect(out.map((s) => s.id)).toEqual(["uiA", "img", "vto"]);
  // Prompt ref retargeted, representation preserved as string, output renamed on collision.
  expect(out[1].config?.prompt).toBe("uiA::prompt_1");
  expect(out[1].config?.input_images).toEqual([{ step: "uiA", output: "prompt_1" }]);
  expect(out[2].config?.model_image).toEqual({ step: "uiA", output: "prompt_1" });
});

test("ensureSingleUserInputStep preserves non-input relative order when primary is not first", () => {
  const out = ensureSingleUserInputStep([
    step("img1", "image"),
    step("ui", "user-input"),
    step("txt1", "text"),
    step("img2", "image"),
  ]);
  expect(out.map((s) => s.id)).toEqual(["ui", "img1", "txt1", "img2"]);
});

test("ensureSingleUserInputStep leaves literal prompt strings untouched", () => {
  const a = step("uiA", "user-input", { inputParams: [{ name: "prompt", type: "text" }] });
  const b = step("uiB", "user-input", { inputParams: [{ name: "beta", type: "text" }] });
  const img = step("img", "image", { config: { prompt: "a literal prompt" } });
  const out = ensureSingleUserInputStep([a, b, img]);
  expect(out[1].config?.prompt).toBe("a literal prompt");
});

test("ensureSingleUserInputStep is idempotent", () => {
  const a = step("uiA", "user-input", { inputParams: [{ name: "prompt", type: "text" }] });
  const b = step("uiB", "user-input", { inputParams: [{ name: "Prompt", type: "image" }] });
  const img = step("img", "image", { config: { prompt: "uiB::Prompt", input_images: [{ step: "uiB", output: "Prompt" }] } });
  const once = ensureSingleUserInputStep([a, b, img]);
  const twice = ensureSingleUserInputStep(once);
  expect(twice).toEqual(once);
});

test("ensureSingleUserInputStep composes idempotently with normalizeWorkflowIdentifiers", () => {
  const a = step("ui-A", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] });
  const b = step("ui_B", "user-input", { inputParams: [{ name: "Prompt", type: "image" }] });
  const img = step("img-1", "image", { config: { prompt: "p", input_images: [{ step: "ui_B", output: "prompt" }] } });
  const composed = normalizeWorkflowIdentifiers(ensureSingleUserInputStep([a, b, img]));
  const recomposed = normalizeWorkflowIdentifiers(ensureSingleUserInputStep(composed));
  expect(recomposed).toEqual(composed);
  expect(composed[0].type).toBe("user-input");
  expect(composed).toHaveLength(2);
});
