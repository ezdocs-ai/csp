/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { parseVtoRemix } from "../remix-handoff";

test("parseVtoRemix rejects non-handoff shapes", () => {
  expect(parseVtoRemix(null)).toBeNull();
  expect(parseVtoRemix(undefined)).toBeNull();
  expect(parseVtoRemix("remixState")).toBeNull();
  expect(parseVtoRemix([])).toBeNull();
  expect(parseVtoRemix({})).toBeNull();
  expect(parseVtoRemix({ modelImagePreviewUrl: "https://s/42.png" })).toBeNull(); // no asset id
  expect(parseVtoRemix({ modelImageAssetId: "42" })).toBeNull(); // id must be numeric
});

test("parseVtoRemix extracts recognized fields and drops unknown", () => {
  const intent = parseVtoRemix({
    modelImageAssetId: 42,
    modelImagePreviewUrl: "https://signed/42.png",
    modelImageMediaIndex: 0,
    modelImageGcsUri: "gs://bucket/42.png",
    unrelatedField: "ignored",
  });
  expect(intent).toEqual({
    modelImageAssetId: 42,
    modelImagePreviewUrl: "https://signed/42.png",
    modelImageMediaIndex: 0,
    modelImageGcsUri: "gs://bucket/42.png",
  });
});

test("parseVtoRemix requires only modelImageAssetId", () => {
  const intent = parseVtoRemix({ modelImageAssetId: 7 });
  expect(intent).toEqual({ modelImageAssetId: 7 });
});
