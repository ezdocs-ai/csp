/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import {
  STEP_FIELDS,
  buildBackendStepConfig,
  defaultStepConfig,
  isModelGatedRefList,
  maxImageInputsForModel,
  missingRequired,
  MODEL_IMAGE_INPUT_CAPABILITIES,
  modelSupportsImageReferences,
  parseRefItem,
  parseRefList,
  refListVisibleFor,
} from "../step-configs";
import type { StepType } from "../../types";

/** Field-name shortcut to keep matrix assertions terse. */
function names(type: StepType): string[] {
  return STEP_FIELDS[type].map((f) => f.name);
}
function field(type: StepType, name: string) {
  const f = STEP_FIELDS[type].find((x) => x.name === name);
  if (!f) throw new Error(`no field ${name} on ${type}`);
  return f;
}

test("defaultStepConfig seeds each declared field with its default", () => {
  const cfg = defaultStepConfig("image");
  expect(cfg.prompt).toBe("");
  expect(cfg.model).toBe("gemini-3.1-flash-image");
  expect(cfg.aspect_ratio).toBe("1:1");
  expect(cfg.brand_guidelines).toBe(false);
});

test("defaultStepConfig(user-input) is empty — backend needs no fields", () => {
  expect(defaultStepConfig("user-input")).toEqual({});
});

test("buildBackendStepConfig splits values into inputs and settings with correct types", () => {
  const cfg = buildBackendStepConfig("image", {
    prompt: "a cat",
    model: "gemini-3.1-flash-image",
    aspect_ratio: "16:9",
    brand_guidelines: true,
  });
  expect(cfg.inputs).toEqual({ prompt: "a cat" });
  expect(cfg.settings).toEqual({
    model: "gemini-3.1-flash-image",
    aspect_ratio: "16:9",
    brand_guidelines: true,
  });
});

test("buildBackendStepConfig coerces temperature to a number", () => {
  const cfg = buildBackendStepConfig("text", { prompt: "hi", model: "m", temperature: "0.5" });
  expect(cfg.settings.temperature).toBe(0.5);
  expect(typeof cfg.settings.temperature).toBe("number");
});

test("buildBackendStepConfig coerces checkbox to boolean", () => {
  const cfg = buildBackendStepConfig("video", { prompt: "p", model: "m", aspect_ratio: "16:9", brand_guidelines: 1 as unknown as boolean });
  expect(cfg.settings.brand_guidelines).toBe(true);
});

test("buildBackendStepConfig(user-input) yields empty inputs and settings", () => {
  expect(buildBackendStepConfig("user-input", {})).toEqual({ inputs: {}, settings: {} });
});

test("buildBackendStepConfig does not emit stray keys (keeps strict backend models happy)", () => {
  const cfg = buildBackendStepConfig("audio", { prompt: "p", model: "lyria-002", voice_name: "Puck" });
  expect(cfg.settings).toEqual({ model: "lyria-002" });
  expect(cfg.settings).not.toHaveProperty("voice_name");
});

// --- field-name matrix mirrors backend workflow_model.py ---------------------

test("text declares backend GenerateTextInputs: prompt + input_images/input_videos ref-lists", () => {
  expect(names("text")).toEqual(["prompt", "input_images", "input_videos", "model", "temperature"]);
  expect(field("text", "input_images")).toMatchObject({ kind: "ref-list", refType: "image" });
  expect(field("text", "input_videos")).toMatchObject({ kind: "ref-list", refType: "video" });
});

test("video declares backend GenerateVideoInputs: prompt, input_images ref-list, start_frame/end_frame refs", () => {
  expect(names("video")).toEqual(["prompt", "input_images", "start_frame", "end_frame", "model", "aspect_ratio", "brand_guidelines"]);
  expect(field("video", "input_images")).toMatchObject({ kind: "ref-list", refType: "image" });
  expect(field("video", "start_frame")).toMatchObject({ kind: "ref", refType: "image" });
  expect(field("video", "start_frame").required).toBeFalsy();
  expect(field("video", "end_frame")).toMatchObject({ kind: "ref", refType: "image" });
  expect(field("video", "end_frame").required).toBeFalsy();
});

test("vto declares backend VirtualTryOnInputs: model_image + top/bottom/dress/shoes scalar image refs", () => {
  expect(names("vto")).toEqual(["model_image", "top_image", "bottom_image", "dress_image", "shoes_image"]);
  expect(field("vto", "model_image")).toMatchObject({ kind: "ref", refType: "image", required: true });
  for (const n of ["top_image", "bottom_image", "dress_image", "shoes_image"]) {
    expect(field("vto", n)).toMatchObject({ kind: "ref", refType: "image" });
    expect(field("vto", n).required).toBeFalsy();
  }
});

test("edit input_images is a REQUIRED ref-list image carrying the image-ingredients gate", () => {
  expect(field("edit", "input_images")).toMatchObject({ kind: "ref-list", refType: "image", required: true, refListCapability: "image-ingredients" });
  expect(names("edit")).toEqual(["input_images", "prompt", "model", "aspect_ratio", "brand_guidelines"]);
});

test("image input_images retains the image-ingredients capability", () => {
  expect(field("image", "input_images").refListCapability).toBe("image-ingredients");
  expect(field("image", "input_images").required).toBeFalsy();
});

// --- acceptsRef prompt contract (text/image/edit/video/audio) ----------------

test("every prompt field is acceptsRef text", () => {
  for (const type of ["text", "image", "edit", "video", "audio"] as StepType[]) {
    const p = field(type, "prompt");
    expect(p.acceptsRef).toBe(true);
    expect(p.refType).toBe("text");
    expect(p.required).toBe(true);
  }
});

test("only prompt fields carry acceptsRef (no ref/ref-list/setting field does)", () => {
  for (const type of Object.keys(STEP_FIELDS) as StepType[]) {
    for (const f of STEP_FIELDS[type]) {
      if (f.name === "prompt") expect(f.acceptsRef).toBe(true);
      else expect(f.acceptsRef).toBeFalsy();
    }
  }
});

test("coerce keeps a structured ref object on an acceptsRef prompt (idempotent)", () => {
  const ref = { step: "s1", output: "generated_text" };
  const once = buildBackendStepConfig("text", { prompt: ref, model: "m", temperature: 0.5 });
  expect(once.inputs.prompt).toEqual(ref);
  // Rebuilding from the built config must not degrade the object to a string.
  const twice = buildBackendStepConfig("text", { prompt: once.inputs.prompt, model: "m", temperature: 0.5 });
  expect(twice.inputs.prompt).toEqual(ref);
});

test("coerce keeps a whole-value ref string as a structured object on an acceptsRef prompt", () => {
  const cfg = buildBackendStepConfig("image", { prompt: "s1::generated_text", model: "m", aspect_ratio: "1:1", brand_guidelines: false });
  expect(cfg.inputs.prompt).toEqual({ step: "s1", output: "generated_text" });
});

test("coerce keeps ordinary prose as a literal string on an acceptsRef prompt", () => {
  const cfg = buildBackendStepConfig("audio", { prompt: "a calm piano track", model: "lyria-002" });
  expect(cfg.inputs.prompt).toBe("a calm piano track");
});

// --- edit input_images ref-list coercion (was scalar) ------------------------

test("buildBackendStepConfig resolves edit input_images (single ref string) to a one-item ref-list", () => {
  const cfg = buildBackendStepConfig("edit", { input_images: "s1::edited_image", prompt: "sharpen", model: "m", aspect_ratio: "1:1", brand_guidelines: false });
  expect(cfg.inputs.input_images).toEqual([{ step: "s1", output: "edited_image" }]);
});

test("buildBackendStepConfig is idempotent for an already-resolved edit input_images ref object (wrapped into the list)", () => {
  const cfg = buildBackendStepConfig("edit", { input_images: [{ step: "s1", output: "edited_image" }], prompt: "x", model: "m", aspect_ratio: "1:1", brand_guidelines: false });
  expect(cfg.inputs.input_images).toEqual([{ step: "s1", output: "edited_image" }]);
});

test("buildBackendStepConfig(vto) emits only model_image and empty settings (optional refs omitted)", () => {
  const cfg = buildBackendStepConfig("vto", { model_image: "s2::generated_image" });
  expect(cfg.inputs).toEqual({ model_image: { step: "s2", output: "generated_image" } });
  expect(cfg.settings).toEqual({});
});

test("buildBackendStepConfig emits an ordered BackendInputRef[] for an image ref-list", () => {
  const cfg = buildBackendStepConfig("image", {
    prompt: "fuse",
    input_images: [{ step: "a", output: "generated_image" }, { step: "b", output: "edited_image" }],
    model: "gemini-3.1-flash-image",
    aspect_ratio: "1:1",
    brand_guidelines: false,
  });
  expect(cfg.inputs.input_images).toEqual([
    { step: "a", output: "generated_image" },
    { step: "b", output: "edited_image" },
  ]);
});

// --- omit empty optional ref / ref-list (strict backend, no surprise keys) ----

test("buildBackendStepConfig omits an empty image ref-list (strict backend, no surprise key)", () => {
  const cfg = buildBackendStepConfig("image", defaultStepConfig("image"));
  expect(cfg.inputs).toEqual({ prompt: "" });
  expect(cfg.inputs).not.toHaveProperty("input_images");
});

test("buildBackendStepConfig omits empty optional generic ref-lists on text and video", () => {
  const text = buildBackendStepConfig("text", { prompt: "p", model: "m", temperature: 0.5 });
  expect(text.inputs).toEqual({ prompt: "p" });
  expect(text.inputs).not.toHaveProperty("input_images");
  expect(text.inputs).not.toHaveProperty("input_videos");
  const video = buildBackendStepConfig("video", { prompt: "p", model: "m", aspect_ratio: "16:9", brand_guidelines: false });
  expect(video.inputs).toEqual({ prompt: "p" });
  expect(video.inputs).not.toHaveProperty("input_images");
  expect(video.inputs).not.toHaveProperty("start_frame");
  expect(video.inputs).not.toHaveProperty("end_frame");
});

test("buildBackendStepConfig omits empty optional scalar refs on vto and video, keeps resolved ones", () => {
  const vto = buildBackendStepConfig("vto", {
    model_image: "m1::generated_image",
    top_image: "",
    bottom_image: "garbage",
    dress_image: "d1::generated_image",
    shoes_image: "",
  });
  expect(vto.inputs).toEqual({
    model_image: { step: "m1", output: "generated_image" },
    // bottom_image is a non-ref literal: unresolved scalar ref coerces to "" then omitted.
    dress_image: { step: "d1", output: "generated_image" },
  });
});

test("buildBackendStepConfig emits resolved optional scalar refs (video start/end frame, vto garments)", () => {
  const video = buildBackendStepConfig("video", {
    prompt: "pan", model: "m", aspect_ratio: "16:9", brand_guidelines: false,
    start_frame: "sf::generated_image", end_frame: "ef::edited_image",
  });
  expect(video.inputs.start_frame).toEqual({ step: "sf", output: "generated_image" });
  expect(video.inputs.end_frame).toEqual({ step: "ef", output: "edited_image" });
});

// --- missingRequired ---------------------------------------------------------

test("missingRequired flags empty prompt for generative types", () => {
  expect(missingRequired("image", defaultStepConfig("image"))).toEqual(["Prompt"]);
  expect(missingRequired("text", { prompt: "  ", model: "m", temperature: 0.7 })).toEqual(["Prompt"]);
  expect(missingRequired("audio", { prompt: "p", model: "m" })).toEqual([]);
});

test("missingRequired flags unresolved required ref-list (edit input_images) and vto model_image", () => {
  expect(missingRequired("edit", defaultStepConfig("edit"))).toEqual(["Input images (from prior steps)", "Edit prompt"]);
  expect(missingRequired("vto", defaultStepConfig("vto"))).toEqual(["Model image (from a prior step)"]);
  expect(missingRequired("vto", { model_image: "s1::generated_image" })).toEqual([]);
});

test("missingRequired accepts a valid ref on a required acceptsRef prompt", () => {
  // String ref form.
  expect(missingRequired("text", { prompt: "s1::generated_text", model: "m", temperature: 0.5 })).toEqual([]);
  // Structured object form.
  expect(missingRequired("audio", { prompt: { step: "s1", output: "generated_audio" }, model: "m" })).toEqual([]);
});

test("missingRequired never flags the optional image ref-list", () => {
  expect(missingRequired("image", defaultStepConfig("image"))).toEqual(["Prompt"]);
  expect(missingRequired("image", { prompt: "p", input_images: [{ step: "a", output: "generated_image" }] })).toEqual([]);
});

test("missingRequired never flags empty optional generic ref-lists/scalar refs (text/video/vto)", () => {
  expect(missingRequired("text", defaultStepConfig("text"))).toEqual(["Prompt"]);
  expect(missingRequired("video", defaultStepConfig("video"))).toEqual(["Prompt"]);
  expect(missingRequired("vto", { model_image: "m::generated_image" })).toEqual([]);
});

test("missingRequired(user-input) is always empty", () => {
  expect(missingRequired("user-input", {})).toEqual([]);
});

// Sanity: every palette type has a spec so none silently falls through to an empty payload.
test("every UI step type has a STEP_FIELDS entry", () => {
  const types: StepType[] = ["user-input", "text", "image", "edit", "video", "vto", "audio"];
  for (const t of types) expect(buildBackendStepConfig(t, defaultStepConfig(t))).toBeDefined();
});

// --- ref-list (ordered BackendInputRef[]) round-trip -------------------------

test("parseRefList coerces 'stepId::output' strings and ref objects, preserving order", () => {
  expect(parseRefList(["s1::generated_image", { step: "s2", output: "edited_image" }])).toEqual([
    { step: "s1", output: "generated_image" },
    { step: "s2", output: "edited_image" },
  ]);
  // Single value (not array) is accepted too.
  expect(parseRefList("s1::generated_image")).toEqual([{ step: "s1", output: "generated_image" }]);
});

test("parseRefItem accepts ref object or 'stepId::output' string, rejects garbage", () => {
  expect(parseRefItem({ step: "s1", output: "o" })).toEqual({ step: "s1", output: "o" });
  expect(parseRefItem("s1::o")).toEqual({ step: "s1", output: "o" });
  expect(parseRefItem("")).toBeNull();
  expect(parseRefItem({ step: 1, output: "o" })).toBeNull();
});

// --- model capability contract (Ingredients-to-Image ref-list gating) ---------
// Interim: mirrors backend GenerationModelEnum.is_gemini_image_model + max_total_inputs.
// When the BFF advertises capability, replace MODEL_IMAGE_INPUT_CAPABILITIES with a
// server-driven resolver (see step-configs.ts follow-up note).

test("MODEL_IMAGE_INPUT_CAPABILITIES lists exactly the backend is_gemini_image_model members", () => {
  // Source of truth: backend/src/common/base_dto.py GenerationModelEnum.is_gemini_image_model.
  expect([...MODEL_IMAGE_INPUT_CAPABILITIES.keys()].sort()).toEqual([
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-image-preview",
    "gemini-3-pro-image",
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-image-preview",
    "gemini-3.1-flash-lite-image",
  ]);
});

test("maxImageInputsForModel returns the per-model backend max, 0 for unsupported", () => {
  // max_total_inputs: gemini-2.5-flash-image* -> 2; gemini-3*-image* -> 14.
  expect(maxImageInputsForModel("gemini-2.5-flash-image")).toBe(2);
  expect(maxImageInputsForModel("gemini-3.1-flash-image")).toBe(14);
  expect(maxImageInputsForModel("gemini-3-pro-image")).toBe(14);
  // Non-gemini-image models are rejected by the executor capability gate.
  expect(maxImageInputsForModel("imagen-4.0-generate-001")).toBe(0);
  expect(maxImageInputsForModel("veo-3.0-generate-001")).toBe(0);
  expect(maxImageInputsForModel(undefined)).toBe(0);
  expect(maxImageInputsForModel("")).toBe(0);
});

test("modelSupportsImageReferences is true for every capability key, false otherwise", () => {
  for (const model of MODEL_IMAGE_INPUT_CAPABILITIES.keys()) {
    expect(modelSupportsImageReferences(model)).toBe(true);
  }
  expect(modelSupportsImageReferences("imagen-4.0-generate-001")).toBe(false);
  expect(modelSupportsImageReferences(undefined)).toBe(false);
});

// --- narrow ref-list capability gating (only image-ingredients is model-gated) ---

test("isModelGatedRefList is true only for image-ingredients ref-lists", () => {
  expect(isModelGatedRefList(field("image", "input_images"))).toBe(true);
  expect(isModelGatedRefList(field("edit", "input_images"))).toBe(true);
  // Generic ref-lists are NOT gated.
  expect(isModelGatedRefList(field("text", "input_images"))).toBe(false);
  expect(isModelGatedRefList(field("text", "input_videos"))).toBe(false);
  expect(isModelGatedRefList(field("video", "input_images"))).toBe(false);
  // Non-ref-list fields are never gated ref-lists.
  expect(isModelGatedRefList(field("text", "prompt"))).toBe(false);
  expect(isModelGatedRefList(field("vto", "model_image"))).toBe(false);
});

test("refListVisibleFor hides only image-ingredients ref-lists on unsupported models; generic ref-lists always visible", () => {
  const gemini = "gemini-3.1-flash-image";
  const veo = "veo-3.0-generate-001";
  const flash = "gemini-3-flash-preview";
  // image-ingredients visible on a supported gemini image model, hidden on Veo/flash.
  expect(refListVisibleFor(field("image", "input_images"), gemini)).toBe(true);
  expect(refListVisibleFor(field("image", "input_images"), veo)).toBe(false);
  expect(refListVisibleFor(field("edit", "input_images"), veo)).toBe(false);
  // Generic ref-lists stay visible regardless of model (no false hiding).
  expect(refListVisibleFor(field("text", "input_images"), flash)).toBe(true);
  expect(refListVisibleFor(field("text", "input_videos"), veo)).toBe(true);
  expect(refListVisibleFor(field("video", "input_images"), veo)).toBe(true);
  // Non-ref-list fields always visible.
  expect(refListVisibleFor(field("text", "prompt"), flash)).toBe(true);
});
