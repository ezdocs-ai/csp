/** Copyright 2026 Google LLC — Apache-2.0 */

import assert from "node:assert/strict";
import { test } from "bun:test";

import { buildUpscaleFormData } from "../types";
import type { UpscaleRequest } from "../types";

const baseSource: UpscaleRequest = {
  workspaceId: 7,
  sourceAssetId: "46",
  factor: 2,
};

test("buildUpscaleFormData maps factor 2|4 to backend upscaleFactor x2|x4", () => {
  assert.equal(buildUpscaleFormData({ ...baseSource, factor: 2 }).get("upscaleFactor"), "x2");
  assert.equal(buildUpscaleFormData({ ...baseSource, factor: 4 }).get("upscaleFactor"), "x4");
});

test("buildUpscaleFormData sends sourceAssetId under the backend `id` alias", () => {
  const form = buildUpscaleFormData(baseSource);
  assert.equal(form.get("id"), "46");
  assert.equal(form.get("workspaceId"), "7");
  assert.equal(form.get("mediaItemId"), null);
});

test("buildUpscaleFormData sends mediaItemId when no sourceAssetId is set", () => {
  const form = buildUpscaleFormData({ workspaceId: 7, mediaItemId: "91", factor: 4 });
  assert.equal(form.get("mediaItemId"), "91");
  assert.equal(form.get("id"), null);
  assert.equal(form.get("upscaleFactor"), "x4");
});

test("buildUpscaleFormData omits enhance/preservation when unset (matches backend optional Form)", () => {
  const form = buildUpscaleFormData(baseSource);
  assert.equal(form.get("enhance_input_image"), null);
  assert.equal(form.get("image_preservation_factor"), null);
});

test("buildUpscaleFormData forwards enhance_input_image and image_preservation_factor when set", () => {
  const form = buildUpscaleFormData({
    ...baseSource,
    enhance_input_image: true,
    image_preservation_factor: 0.4,
  });
  assert.equal(form.get("enhance_input_image"), "true");
  assert.equal(form.get("image_preservation_factor"), "0.4");
});

test("buildUpscaleFormData treats null image_preservation_factor as unset", () => {
  const form = buildUpscaleFormData({ ...baseSource, image_preservation_factor: null });
  assert.equal(form.get("image_preservation_factor"), null);
});
