/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import {
  ASSET_TYPE_OPTIONS,
  MEDIA_TYPE_OPTIONS,
  MODEL_OPTIONS,
  filterModelOptions,
  isModelValidForType,
  parseTagsParam,
  serializeTagsParam,
  toggleTag,
} from "../gallery-filters";

test("filterModelOptions: no media type returns all models with All Models first", () => {
  const opts = filterModelOptions("");
  expect(opts[0]).toEqual({ value: "", label: "All Models" });
  // Every MODEL_OPTIONS entry appears (IMAGE + TEXT + VIDEO + AUDIO).
  expect(opts.length).toBe(MODEL_OPTIONS.length + 1);
});

test("filterModelOptions: null media type behaves as All Types", () => {
  expect(filterModelOptions(null)).toEqual(filterModelOptions(""));
  expect(filterModelOptions(undefined)).toEqual(filterModelOptions(""));
});

test("filterModelOptions: image/* shows only IMAGE models", () => {
  const opts = filterModelOptions("image/*");
  expect(opts[0]).toEqual({ value: "", label: "All Models" });
  const imageModels = MODEL_OPTIONS.filter((m) => m.type === "IMAGE");
  expect(opts.length).toBe(imageModels.length + 1);
  expect(opts.every((o) => o.value === "" || MODEL_OPTIONS.find((m) => m.value === o.value)?.type === "IMAGE")).toBe(true);
});

test("filterModelOptions: video/* shows only VIDEO models", () => {
  const opts = filterModelOptions("video/*");
  const videoModels = MODEL_OPTIONS.filter((m) => m.type === "VIDEO");
  expect(opts.length).toBe(videoModels.length + 1);
  expect(opts.find((o) => o.value === "veo-3.1-generate-001")).toEqual({ value: "veo-3.1-generate-001", label: "Veo 3.1" });
});

test("filterModelOptions: audio/* shows only AUDIO models", () => {
  const opts = filterModelOptions("audio/*");
  const audioModels = MODEL_OPTIONS.filter((m) => m.type === "AUDIO");
  expect(opts.length).toBe(audioModels.length + 1);
  expect(opts.find((o) => o.value === "lyria-002")).toEqual({ value: "lyria-002", label: "Lyria" });
});

test("filterModelOptions: TEXT models only appear under All Types", () => {
  expect(filterModelOptions("image/*").some((o) => o.value === "gemini-2.5-pro")).toBe(false);
  expect(filterModelOptions("").some((o) => o.value === "gemini-2.5-pro")).toBe(true);
});

test("isModelValidForType: empty model is always valid", () => {
  expect(isModelValidForType("", "image/*")).toBe(true);
  expect(isModelValidForType(null, "video/*")).toBe(true);
  expect(isModelValidForType(undefined, "")).toBe(true);
});

test("isModelValidForType: image model valid under image/*, invalid under video/*", () => {
  expect(isModelValidForType("gemini-3.1-flash-image", "image/*")).toBe(true);
  expect(isModelValidForType("gemini-3.1-flash-image", "video/*")).toBe(false);
  expect(isModelValidForType("gemini-3.1-flash-image", "")).toBe(true);
});

test("isModelValidForType: TEXT model valid under All Types only", () => {
  expect(isModelValidForType("gemini-2.5-flash", "")).toBe(true);
  expect(isModelValidForType("gemini-2.5-flash", "image/*")).toBe(false);
  expect(isModelValidForType("gemini-2.5-flash", "audio/*")).toBe(false);
});

test("parseTagsParam: empty / null / undefined yields []", () => {
  expect(parseTagsParam("")).toEqual([]);
  expect(parseTagsParam(null)).toEqual([]);
  expect(parseTagsParam(undefined)).toEqual([]);
});

test("parseTagsParam: splits, trims, drops blanks, de-dupes", () => {
  expect(parseTagsParam("cat, dog ,cat")).toEqual(["cat", "dog"]);
  expect(parseTagsParam(",, ,")).toEqual([]);
  expect(parseTagsParam("solo")).toEqual(["solo"]);
});

test("serializeTagsParam: joins with comma, drops blanks", () => {
  expect(serializeTagsParam(["cat", "dog"])).toBe("cat,dog");
  expect(serializeTagsParam(["a", "", "b"])).toBe("a,b");
  expect(serializeTagsParam([])).toBe("");
});

test("toggleTag: adds then removes", () => {
  expect(toggleTag([], "cat")).toEqual(["cat"]);
  expect(toggleTag(["cat", "dog"], "cat")).toEqual(["dog"]);
  expect(toggleTag(["dog"], "cat")).toEqual(["dog", "cat"]);
});

test("MEDIA_TYPE_OPTIONS and ASSET_TYPE_OPTIONS have All sentinel first", () => {
  expect(MEDIA_TYPE_OPTIONS[0]).toEqual({ value: "", label: "All Types" });
  expect(ASSET_TYPE_OPTIONS[0]).toEqual({ value: "", label: "All Assets" });
  expect(ASSET_TYPE_OPTIONS.map((o) => o.value)).toEqual(["", "media_item", "source_asset"]);
});

test("round-trip: parseTagsParam ∘ serializeTagsParam is stable for clean input", () => {
  const names = ["alpha", "beta", "gamma"];
  expect(parseTagsParam(serializeTagsParam(names))).toEqual(names);
});
