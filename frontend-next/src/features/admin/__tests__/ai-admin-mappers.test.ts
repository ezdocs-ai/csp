/**
 * Copyright 2026 Google LLC — Apache-2.0
 */
import { expect, test } from "bun:test";

import { providerToInput } from "../components/ai-providers-admin";
import { modelToInput } from "../components/ai-models-admin";

const provider = {
  id: 7,
  key: "vertex",
  displayName: "Vertex",
  providerType: "google_vertex",
  enabled: true,
  baseUrl: "https://v",
  timeoutSeconds: 90,
  hasSecret: true,
  secretVersion: null,
};

const model = {
  id: 3,
  key: "veo",
  providerId: 7,
  vendorModelId: "veo-3",
  mediaType: "video",
  displayName: "Veo",
  enabled: true,
  capabilities: { textToVideo: true, imageToVideo: false, durations: [5], aspectRatios: ["16:9"], resolutions: ["1K"], maxOutputs: 1 },
  defaults: { durationSeconds: null, aspectRatio: null, resolution: null },
  costMetadata: null,
  environment: "production",
  priority: 50,
};

test("providerToInput preserves fields and applies the enabled override", () => {
  const input = providerToInput(provider, false);
  expect(input.key).toBe("vertex");
  expect(input.providerType).toBe("google_vertex");
  expect(input.timeoutSeconds).toBe(90);
  expect(input.enabled).toBe(false);
  expect(input.secretRef).toBeUndefined();
});

test("modelToInput preserves fields and applies the enabled override", () => {
  const input = modelToInput(model, false);
  expect(input.key).toBe("veo");
  expect(input.providerId).toBe(7);
  expect(input.capabilities?.durations).toEqual([5]);
  expect(input.enabled).toBe(false);
});
