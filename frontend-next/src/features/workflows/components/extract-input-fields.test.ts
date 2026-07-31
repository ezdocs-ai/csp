/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { extractInputFields, inputFields } from "./extract-input-fields";

test("extractInputFields reads backend outputs { name: { type } } (text + image)", () => {
  const def = { steps: [{ type: "user_input", outputs: { prompt: { type: "text" }, hero: { type: "image" } } }] };
  expect(extractInputFields(def)).toEqual([{ name: "prompt", type: "text" }, { name: "hero", type: "image" }]);
});

test("extractInputFields defaults an unknown/missing type to text", () => {
  expect(extractInputFields({ steps: [{ type: "user_input", outputs: { a: { type: "weird" }, b: {}, c: null } }] })).toEqual([
    { name: "a", type: "text" },
    { name: "b", type: "text" },
    { name: "c", type: "text" },
  ]);
});

test("extractInputFields falls back to legacy inputs keys (all text)", () => {
  const def = { steps: [{ type: "user-input", inputs: { foo: "x", bar: 1 } }] };
  expect(extractInputFields(def)).toEqual([{ name: "foo", type: "text" }, { name: "bar", type: "text" }]);
});

test("extractInputFields falls back to legacy fields keys", () => {
  expect(extractInputFields({ steps: [{ type: "user_input", fields: { z: { type: "image" } } }] })).toEqual([
    { name: "z", type: "image" },
  ]);
});

test("extractInputFields prefers outputs over legacy inputs when both present", () => {
  const def = { steps: [{ type: "user_input", outputs: { a: { type: "image" } }, inputs: { b: 1 } }] };
  expect(extractInputFields(def)).toEqual([{ name: "a", type: "image" }]);
});

test("extractInputFields accepts a bare step array (no {steps} envelope)", () => {
  expect(extractInputFields([{ type: "user_input", outputs: { q: { type: "text" } } }])).toEqual([
    { name: "q", type: "text" },
  ]);
});



test("extractInputFields matches both user_input and user-input discriminators", () => {
  expect(extractInputFields({ steps: [{ type: "USER_INPUT", outputs: { a: { type: "text" } } }] })).toEqual([
    { name: "a", type: "text" },
  ]);
  expect(extractInputFields({ steps: [{ type: "user-input", outputs: { a: { type: "text" } } }] })).toEqual([
    { name: "a", type: "text" },
  ]);
});

test("extractInputFields ignores non-user-input steps", () => {
  const def = { steps: [{ type: "generate_image", inputs: { prompt: "x" } }, { type: "user_input", outputs: { p: { type: "text" } } }] };
  expect(extractInputFields(def)).toEqual([{ name: "p", type: "text" }]);
});

test("extractInputFields de-dupes by name across steps, first-seen type wins", () => {
  const def = { steps: [
    { type: "user_input", outputs: { dup: { type: "image" } } },
    { type: "user_input", outputs: { dup: { type: "text" }, other: { type: "text" } } },
  ] };
  expect(extractInputFields(def)).toEqual([{ name: "dup", type: "image" }, { name: "other", type: "text" }]);
});

test("extractInputFields returns [] for malformed/empty input", () => {
  expect(extractInputFields(null)).toEqual([]);
  expect(extractInputFields(undefined)).toEqual([]);
  expect(extractInputFields("nope")).toEqual([]);
  expect(extractInputFields({})).toEqual([]);
  expect(extractInputFields({ steps: [] })).toEqual([]);
  expect(extractInputFields({ steps: [{ type: "generate_image" }] })).toEqual([]);
});

test("extractInputFields returns [] for a user_input step with no outputs/inputs/fields", () => {
  expect(extractInputFields({ steps: [{ type: "user_input" }] })).toEqual([]);
  expect(extractInputFields({ steps: [{ type: "user_input", outputs: {} }] })).toEqual([]);
});

test("inputFields shim returns names only as string[] (back-compat)", () => {
  const def = { steps: [{ type: "user_input", outputs: { prompt: { type: "text" }, hero: { type: "image" } } }] };
  expect(inputFields(def)).toEqual(["prompt", "hero"]);
});
