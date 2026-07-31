/** Copyright 2026 Google LLC — Apache-2.0 */

import assert from "node:assert/strict";
import { test } from "bun:test";

import {
  formatRatioLabel,
  IMAGE_MODEL_OPTIONS,
  isGoogleSearchEligible,
  RATIO_LABELS,
} from "../types";

test("IMAGE_MODEL_OPTIONS matches the Angular image-only model order", () => {
  assert.deepEqual(
    IMAGE_MODEL_OPTIONS.map((model) => model.value),
    [
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-lite-image",
      "gemini-3-pro-image",
      "gemini-2.5-flash-image",
    ],
  );
});

test("formatRatioLabel appends the Angular viewValue label", () => {
  assert.equal(formatRatioLabel("1:1"), "1:1 Square");
  assert.equal(formatRatioLabel("16:9"), "16:9 Horizontal");
  assert.equal(formatRatioLabel("8:1"), "8:1 Wide Ribbon");
});

test("formatRatioLabel falls back to the raw ratio when unknown", () => {
  assert.equal(formatRatioLabel("7:5"), "7:5");
});

test("RATIO_LABELS covers all 14 Angular aspect ratios", () => {
  assert.equal(Object.keys(RATIO_LABELS).length, 14);
});

test("isGoogleSearchEligible is true only for the three allowlisted models", () => {
  assert.equal(isGoogleSearchEligible("gemini-3-pro-image"), true);
  assert.equal(isGoogleSearchEligible("gemini-3.1-flash-image"), true);
  assert.equal(isGoogleSearchEligible("gemini-3.1-flash-lite-image"), true);
});

test("isGoogleSearchEligible is false for other models", () => {
  assert.equal(isGoogleSearchEligible("nano-banana-2"), false);
  assert.equal(isGoogleSearchEligible("imagen-4.0-generate-001"), false);
  assert.equal(isGoogleSearchEligible(""), false);
});
