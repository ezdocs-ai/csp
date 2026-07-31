/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { normalizeParamOutputName, outputsToParams, paramsToOutputs, reorder, toIdentifier } from "../transforms";
import type { InputParam } from "../../types";

test("toIdentifier lowercases and snake-cases display names", () => {
  expect(toIdentifier("Prompt")).toBe("prompt");
  expect(toIdentifier("User Image")).toBe("user_image");
  expect(toIdentifier("  Hero  Shot!! ")).toBe("hero_shot");
});

test("toIdentifier returns empty for blank-only names", () => {
  expect(toIdentifier("   ")).toBe("");
  expect(toIdentifier("!!!")).toBe("");
});

test("paramsToOutputs serializes params to { name: { type } } with identifier keys", () => {
  const params: InputParam[] = [
    { name: "Prompt", type: "text" },
    { name: "User Image", type: "image" },
  ];
  expect(paramsToOutputs(params)).toEqual({ prompt: { type: "text" }, user_image: { type: "image" } });
});

test("paramsToOutputs skips blank-named params (an empty new row never serializes)", () => {
  expect(paramsToOutputs([{ name: "", type: "text" }, { name: "ok", type: "text" }])).toEqual({ ok: { type: "text" } });
  expect(paramsToOutputs([])).toEqual({});
});

test("paramsToOutputs prefixes leading-digit outputs with input_ (canonical normalizeParamOutputName)", () => {
  // Single source of truth: paramsToOutputs must match save-time
  // normalizeParamOutputName, including the leading-digit `input_` prefix.
  expect(paramsToOutputs([{ name: "1 Shot", type: "text" }])).toEqual({ input_1_shot: { type: "text" } });
  expect(paramsToOutputs([{ name: "123", type: "image" }])).toEqual({ input_123: { type: "image" } });
  // Non-digit-leading names are untouched.
  expect(paramsToOutputs([{ name: "Hero Shot", type: "text" }])).toEqual({ hero_shot: { type: "text" } });
});

test("normalizeParamOutputName lower-snakes, prefixes leading digits, and empties blanks", () => {
  expect(normalizeParamOutputName("Prompt")).toBe("prompt");
  expect(normalizeParamOutputName("User Image")).toBe("user_image");
  expect(normalizeParamOutputName("  Hero  Shot!! ")).toBe("hero_shot");
  // Leading-digit -> `input_` prefix (matches Angular / backend contract).
  expect(normalizeParamOutputName("1st Photo")).toBe("input_1st_photo");
  expect(normalizeParamOutputName("123")).toBe("input_123");
  // Digit-only after another char stays untouched (no leading digit).
  expect(normalizeParamOutputName("a1")).toBe("a1");
  // Blanks -> empty so an empty new-param row never serializes.
  expect(normalizeParamOutputName("")).toBe("");
  expect(normalizeParamOutputName("   ")).toBe("");
  expect(normalizeParamOutputName("!!!")).toBe("");
});

test("paramsToOutputs and outputsToParams round-trip", () => {
  const params: InputParam[] = [{ name: "prompt", type: "text" }, { name: "hero", type: "image" }];
  expect(outputsToParams(paramsToOutputs(params))).toEqual(params);
});

test("outputsToParams ignores malformed output entries", () => {
  expect(outputsToParams({ good: { type: "image" }, bad: "nope", also: null })).toEqual([{ name: "good", type: "image" }]);
  expect(outputsToParams(undefined)).toEqual([]);
  expect(outputsToParams(null)).toEqual([]);
});

test("outputsToParams defaults an unknown type to text", () => {
  expect(outputsToParams({ x: { type: "unknown" } })).toEqual([{ name: "x", type: "text" }]);
});

test("reorder moves an item forward (0 -> 2)", () => {
  expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
});

test("reorder moves an item backward (2 -> 0)", () => {
  expect(reorder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
});

test("reorder is a no-op when from === to", () => {
  expect(reorder(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
});

test("reorder is a no-op on out-of-range indices and does not mutate", () => {
  const list = ["a", "b"];
  expect(reorder(list, -1, 0)).toEqual(["a", "b"]);
  expect(reorder(list, 0, 5)).toEqual(["a", "b"]);
  expect(list).toEqual(["a", "b"]); // original untouched
});
