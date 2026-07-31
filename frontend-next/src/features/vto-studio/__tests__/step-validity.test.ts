/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { isStepOneValid } from "../types";

test("isStepOneValid requires both a gender and a person asset", () => {
  expect(isStepOneValid("", "")).toBe(false);
  expect(isStepOneValid("female", "")).toBe(false);
  expect(isStepOneValid("", "42")).toBe(false);
  expect(isStepOneValid("female", "42")).toBe(true);
  expect(isStepOneValid("male", "42")).toBe(true);
});
