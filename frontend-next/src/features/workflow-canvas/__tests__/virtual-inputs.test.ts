/** Copyright 2026 Google LLC — Apache-2.0
 * Focused tests for the pure virtual-input helpers (Serena memory
 * `migration_nextjs/workflow_canvas_reactflow/v2_independent_input_nodes`).
 * No React, no React Flow — pure adapter behavior only. */
import { expect, test } from "bun:test";

import type { BackendInputRef, BackendInputValue } from "../../workflow-editor/hooks/step-configs";
import type { InputParam, WorkflowStep } from "../../workflow-editor/types";
import {
  VIRTUAL_INPUT_DELIMITER,
  clearSingletonOutputRef,
  clearSingletonOutputRefFromConfig,
  clearSingletonOutputRefFromStep,
  clearSingletonOutputRefFromWorkflow,
  expandVirtualInputs,
  inferIngredientsVariant,
  isVirtualInputId,
  parseVirtualInputId,
  sourceToVirtualId,
  virtualIdToBackendRef,
  virtualInputId,
} from "../adapters/virtual-inputs";

/* -------------------------------- fixtures -------------------------------- */

const userInput = (id: string, params: InputParam[] = []): WorkflowStep => ({
  id,
  type: "user-input",
  label: id,
  inputs: [{ mode: "fixed" }],
  inputParams: params,
});

const param = (name: string, type: InputParam["type"] = "text"): InputParam => ({ name, type });

/* ------------------------------- virtual ids ------------------------------ */

test("virtualInputId joins singleton + normalized output with the delimiter", () => {
  expect(virtualInputId("user_input", "photo")).toBe(`user_input${VIRTUAL_INPUT_DELIMITER}photo`);
});

test("VIRTUAL_INPUT_DELIMITER is the documented double-underscore token", () => {
  expect(VIRTUAL_INPUT_DELIMITER).toBe("__ui__");
});

test("parseVirtualInputId round-trips a well-formed id", () => {
  const id = virtualInputId("user_input", "photo");
  expect(parseVirtualInputId(id)).toEqual({ singletonStepId: "user_input", output: "photo" });
});

test("parseVirtualInputId splits on the LAST delimiter so legacy ids with the token survive", () => {
  // A singleton id that (legacy) already contains the delimiter token must keep the
  // trailing real output intact; the left side is treated as the whole singleton id.
  const id = `a${VIRTUAL_INPUT_DELIMITER}b${VIRTUAL_INPUT_DELIMITER}photo`;
  expect(parseVirtualInputId(id)).toEqual({ singletonStepId: `a${VIRTUAL_INPUT_DELIMITER}b`, output: "photo" });
});

test("isVirtualInputId mirrors parseVirtualInputId", () => {
  expect(isVirtualInputId(virtualInputId("u1", "photo"))).toBe(true);
  expect(isVirtualInputId("not_a_virtual_id")).toBe(false);
});

/* --------------------------- malformed virtual ids ------------------------ */

test("parseVirtualInputId rejects an id without the delimiter", () => {
  expect(parseVirtualInputId("u1")).toBeNull();
});

test("parseVirtualInputId rejects an id where the delimiter leads (empty singleton)", () => {
  expect(parseVirtualInputId(`${VIRTUAL_INPUT_DELIMITER}photo`)).toBeNull();
});

test("parseVirtualInputId rejects an id with an empty output segment", () => {
  expect(parseVirtualInputId(`u1${VIRTUAL_INPUT_DELIMITER}`)).toBeNull();
});

test("parseVirtualInputId rejects an id with an unsafe (hyphenated) singleton id", () => {
  expect(parseVirtualInputId(`bad-id${VIRTUAL_INPUT_DELIMITER}photo`)).toBeNull();
});

test("parseVirtualInputId rejects an id with an unsafe (hyphenated) output", () => {
  expect(parseVirtualInputId(`u1${VIRTUAL_INPUT_DELIMITER}bad-out`)).toBeNull();
});

test("isVirtualInputId is false for every malformed shape", () => {
  expect(isVirtualInputId("u1")).toBe(false);
  expect(isVirtualInputId(`${VIRTUAL_INPUT_DELIMITER}photo`)).toBe(false);
  expect(isVirtualInputId(`u1${VIRTUAL_INPUT_DELIMITER}`)).toBe(false);
  expect(isVirtualInputId(`bad-id${VIRTUAL_INPUT_DELIMITER}photo`)).toBe(false);
});

test("virtualIdToBackendRef returns null for malformed ids", () => {
  expect(virtualIdToBackendRef("u1")).toBeNull();
  expect(virtualIdToBackendRef(`bad-id${VIRTUAL_INPUT_DELIMITER}photo`)).toBeNull();
});

/* ----------------------- backend ref resolution --------------------------- */

test("virtualIdToBackendRef resolves a valid id to {step, output}", () => {
  expect(virtualIdToBackendRef(virtualInputId("user_input", "photo"))).toEqual({
    step: "user_input",
    output: "photo",
  });
});

/* ---------------------- leading-digit normalization ----------------------- */

test("expandVirtualInputs prefixes digit-leading param names with input_", () => {
  const [d] = expandVirtualInputs(userInput("u1", [param("1st Photo", "image")]));
  expect(d.output).toBe("input_1st_photo");
  expect(d.id).toBe(virtualInputId("u1", "input_1st_photo"));
});

test("expandVirtualInputs lower-snakes spaces and punctuation in param names", () => {
  const [d] = expandVirtualInputs(userInput("u1", [param("User Name!")]));
  expect(d.output).toBe("user_name");
});

/* ------------------------------ expansion --------------------------------- */

test("expandVirtualInputs returns [] for non user-input steps", () => {
  expect(expandVirtualInputs({ ...userInput("u1", [param("a")]), type: "text" })).toEqual([]);
});

test("expandVirtualInputs skips blank / whitespace-only param names", () => {
  const descriptors = expandVirtualInputs(
    userInput("u1", [param("   "), param("real", "text")]),
  );
  expect(descriptors).toHaveLength(1);
  expect(descriptors[0].output).toBe("real");
});

test("expandVirtualInputs preserves inputParams order", () => {
  const descriptors = expandVirtualInputs(
    userInput("u1", [param("alpha"), param("beta"), param("gamma")]),
  );
  expect(descriptors.map((d) => d.output)).toEqual(["alpha", "beta", "gamma"]);
});

test("expandVirtualInputs populates descriptor fields for a text param", () => {
  const [d] = expandVirtualInputs(userInput("u1", [param("Prompt", "text")]));
  expect(d).toEqual({
    id: virtualInputId("u1", "prompt"),
    singletonStepId: "u1",
    output: "prompt",
    displayName: "Prompt",
    canvasKind: "text",
    paramType: "text",
    refType: "text",
  });
});

test("expandVirtualInputs maps an image param to image canvas kind + image refType", () => {
  const [d] = expandVirtualInputs(userInput("u1", [param("Photo", "image")]));
  expect(d.canvasKind).toBe("image");
  expect(d.paramType).toBe("image");
  expect(d.refType).toBe("image");
});

test("expandVirtualInputs keeps the stored display name even after normalization", () => {
  const [d] = expandVirtualInputs(userInput("u1", [param("1st Photo", "image")]));
  expect(d.displayName).toBe("1st Photo");
  expect(d.output).toBe("input_1st_photo");
});

/* ---------------------------- source mapping ------------------------------ */

test("sourceToVirtualId returns the matching descriptor id", () => {
  const descriptors = expandVirtualInputs(userInput("u1", [param("a"), param("b")]));
  expect(sourceToVirtualId({ step: "u1", output: "b" }, descriptors)).toBe(virtualInputId("u1", "b"));
});

test("sourceToVirtualId returns null when the ref points at another step", () => {
  const descriptors = expandVirtualInputs(userInput("u1", [param("a")]));
  expect(sourceToVirtualId({ step: "other", output: "a" }, descriptors)).toBeNull();
});

test("sourceToVirtualId returns null when the output does not exist on the singleton", () => {
  const descriptors = expandVirtualInputs(userInput("u1", [param("a")]));
  expect(sourceToVirtualId({ step: "u1", output: "missing" }, descriptors)).toBeNull();
});

/* ------------------- exact-output ref cleanup: slot level ----------------- */

const ref = (step: string, output: string): BackendInputRef => ({ step, output });

test("clearSingletonOutputRef clears a matching structured scalar ref to ''", () => {
  expect(clearSingletonOutputRef(ref("u1", "photo"), "u1", "photo")).toBe("");
});

test("clearSingletonOutputRef leaves a non-matching structured scalar ref untouched", () => {
  const sibling = ref("u1", "name");
  expect(clearSingletonOutputRef(sibling, "u1", "photo")).toBe(sibling);
});

test("clearSingletonOutputRef clears an exact legacy 'step::output' string to ''", () => {
  expect(clearSingletonOutputRef("u1::photo", "u1", "photo")).toBe("");
});

test("clearSingletonOutputRef leaves a non-matching legacy string untouched", () => {
  expect(clearSingletonOutputRef("u1::name", "u1", "photo")).toBe("u1::name");
  expect(clearSingletonOutputRef("u2::photo", "u1", "photo")).toBe("u2::photo");
});

test("clearSingletonOutputRef leaves literal scalars untouched", () => {
  expect(clearSingletonOutputRef("hello", "u1", "photo")).toBe("hello");
  expect(clearSingletonOutputRef(42, "u1", "photo")).toBe(42);
  expect(clearSingletonOutputRef(true, "u1", "photo")).toBe(true);
});

/* ------------------- exact-output ref cleanup: list level ----------------- */

test("clearSingletonOutputRef filters matching ref objects AND legacy strings, preserving order", () => {
  const list: Array<BackendInputRef | string> = [
    ref("u1", "photo"),
    ref("u1", "name"),
    "u1::photo",
    ref("u2", "photo"),
    "u1::name",
  ];
  // Mixed structured-ref + legacy-string arrays are not expressible in
  // BackendInputValue, but the helper preserves them; cast as on the input above.
  expect(clearSingletonOutputRef(list as BackendInputValue, "u1", "photo")).toEqual([
    ref("u1", "name"),
    ref("u2", "photo"),
    "u1::name",
  ] as BackendInputValue);
});

test("clearSingletonOutputRef on a list leaves sibling outputs intact", () => {
  const list: BackendInputValue = [ref("u1", "photo"), ref("u1", "name"), ref("u1", "other")];
  expect(clearSingletonOutputRef(list, "u1", "photo")).toEqual([ref("u1", "name"), ref("u1", "other")]);
});

test("clearSingletonOutputRef returns a non-array, non-matching value unchanged", () => {
  const unrelated = ref("u2", "photo");
  expect(clearSingletonOutputRef(unrelated, "u1", "photo")).toBe(unrelated);
});

/* ---------------- exact-output ref cleanup: config / step / workflow ------- */

test("clearSingletonOutputRefFromConfig clears only the targeted slot's matching ref", () => {
  const config = {
    prompt: "u1::photo",
    other: ref("u1", "name"),
    keep: "literal",
    list: [ref("u1", "photo"), ref("u2", "photo")] as BackendInputValue,
  };
  const next = clearSingletonOutputRefFromConfig(config, "u1", "photo");
  expect(next.prompt).toBe("");
  expect(next.other).toEqual(ref("u1", "name"));
  expect(next.keep).toBe("literal");
  expect(next.list).toEqual([ref("u2", "photo")]);
});

test("clearSingletonOutputRefFromConfig does not mutate the input config", () => {
  const config = { prompt: "u1::photo" };
  clearSingletonOutputRefFromConfig(config, "u1", "photo");
  expect(config.prompt).toBe("u1::photo");
});

test("clearSingletonOutputRefFromStep returns the step unchanged when it has no config", () => {
  const step = userInput("u1", [param("a")]);
  expect(clearSingletonOutputRefFromStep(step, "u1", "a")).toBe(step);
});

test("clearSingletonOutputRefFromStep clears matching refs in the step config", () => {
  const step: WorkflowStep = {
    id: "gen",
    type: "text",
    label: "gen",
    inputs: [{ mode: "fixed" }],
    config: { prompt: "u1::photo", keep: "u1::name" },
  };
  const next = clearSingletonOutputRefFromStep(step, "u1", "photo");
  expect(next.config?.prompt).toBe("");
  expect(next.config?.keep).toBe("u1::name");
  expect(step.config?.prompt).toBe("u1::photo"); // input not mutated
});

test("clearSingletonOutputRefFromWorkflow clears one output across all steps, keeping siblings", () => {
  const singleton = userInput("u1", [param("photo"), param("name")]);
  const consumer: WorkflowStep = {
    id: "gen",
    type: "text",
    label: "gen",
    inputs: [{ mode: "fixed" }],
    config: {
      prompt: "u1::photo",
      other: ref("u1", "name"),
      list: [ref("u1", "photo"), ref("u1", "name"), ref("u2", "photo")] as BackendInputValue,
    },
  };
  const next = clearSingletonOutputRefFromWorkflow([singleton, consumer], "u1", "photo");
  expect(next).toHaveLength(2);
  expect(next[0]).toBe(singleton); // singleton has no config -> returned by-value unchanged
  expect(next[1].config).toEqual({
    prompt: "",
    other: ref("u1", "name"),
    list: [ref("u1", "name"), ref("u2", "photo")],
  });
  // original consumer config untouched (pure)
  expect(consumer.config?.prompt).toBe("u1::photo");
});

/* ----------------------- ingredients variant inference ------------------- */

const IMG_MODEL = "gemini-3.1-flash-image";
const NON_IMG_MODEL = "gemini-3-flash-preview";

test("inferIngredientsVariant returns 'image' for a step type without the image-ingredients field", () => {
  // text has a generic input_images ref-list (no refListCapability tag)
  expect(inferIngredientsVariant({ input_images: [ref("u1", "img")] }, "text", IMG_MODEL)).toBe("image");
});

test("inferIngredientsVariant returns 'image' when input_images is empty (save-blocking until connected)", () => {
  expect(inferIngredientsVariant({ input_images: [] }, "image", IMG_MODEL)).toBe("image");
  expect(inferIngredientsVariant({}, "image", IMG_MODEL)).toBe("image");
});

test("inferIngredientsVariant returns 'ingredients' for an image step with refs + supported model", () => {
  expect(
    inferIngredientsVariant({ input_images: [ref("u1", "img")] }, "image", IMG_MODEL),
  ).toBe("ingredients");
});

test("inferIngredientsVariant returns 'image' when the model does not support image references", () => {
  expect(
    inferIngredientsVariant({ input_images: [ref("u1", "img")] }, "image", NON_IMG_MODEL),
  ).toBe("image");
});

test("inferIngredientsVariant returns 'ingredients' for an edit step with refs + supported model", () => {
  expect(
    inferIngredientsVariant({ input_images: [ref("u1", "img")] }, "edit", IMG_MODEL),
  ).toBe("ingredients");
});

test("inferIngredientsVariant returns 'image' when the model is undefined", () => {
  expect(inferIngredientsVariant({ input_images: [ref("u1", "img")] }, "image", undefined)).toBe("image");
});
