/** Copyright 2026 Google LLC — Apache-2.0 */

import assert from "node:assert/strict";
import { test } from "bun:test";

import {
  pickModel,
  safeAspectRatios,
  safeDurations,
  safeMaxOutputs,
  safeResolutions,
} from "../hooks/use-video-capabilities";
import type { VideoGenerationOptions, VideoModelOption } from "../types";

const baseModel = (overrides: Partial<VideoModelOption> = {}): VideoModelOption => ({
  modelKey: "veo-3.1",
  displayName: "Veo 3.1",
  vendorModelId: "veo-3.1-generate-001",
  providerKey: "google_vertex",
  providerType: "google_vertex",
  environment: "production",
  priority: 10,
  capabilities: {
    textToVideo: true,
    imageToVideo: false,
    durations: [5, 8],
    aspectRatios: ["16:9"],
    resolutions: ["1K", "2K"],
    maxOutputs: 1,
  },
  defaults: { durationSeconds: 8, aspectRatio: "16:9", resolution: "1K" },
  ...overrides,
});

const options: VideoGenerationOptions = {
  defaultModelKey: "veo-3.1",
  models: [baseModel(), baseModel({ modelKey: "omni-flash", displayName: "Omni Flash", priority: 20 })],
};

test("pickModel returns the requested key when present", () => {
  assert.equal(pickModel(options, "omni-flash")?.modelKey, "omni-flash");
});

test("pickModel falls back to default model key when requested is missing", () => {
  assert.equal(pickModel(options, "missing-key")?.modelKey, "veo-3.1");
});

test("pickModel returns null when registry is empty", () => {
  assert.equal(pickModel(null, "any"), null);
  assert.equal(pickModel({ defaultModelKey: null, models: [] }, undefined), null);
});

test("safeResolutions uses registry list when non-empty, otherwise fallback", () => {
  assert.deepEqual(safeResolutions(baseModel().capabilities), ["1K", "2K"]);
  assert.deepEqual(safeResolutions(null), ["1K", "2K", "4K"]);
});

test("safeDurations uses registry list when non-empty, otherwise fallback", () => {
  assert.deepEqual(safeDurations(baseModel().capabilities), [5, 8]);
  assert.deepEqual(safeDurations({ ...baseModel().capabilities, durations: [] }), [5, 8]);
});

test("safeAspectRatios uses registry list when non-empty, otherwise fallback", () => {
  assert.deepEqual(safeAspectRatios(baseModel().capabilities), ["16:9"]);
});

test("safeMaxOutputs returns registry value when positive, otherwise 1", () => {
  assert.equal(safeMaxOutputs({ ...baseModel().capabilities, maxOutputs: 4 }), 4);
  assert.equal(safeMaxOutputs(null), 1);
});
