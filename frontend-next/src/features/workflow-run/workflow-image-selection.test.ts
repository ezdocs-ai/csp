/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import type { SourceAsset } from "@/src/features/source-assets/types";
import { selectionsToInputs, toSelectedImage } from "./workflow-image-selection";

const asset = (over: Partial<SourceAsset> = {}): SourceAsset => ({
  id: "42",
  name: "hero.png",
  type: "image",
  thumbnailUrl: "t.jpg",
  url: "u.jpg",
  ...over,
});

test("toSelectedImage coerces the asset id to an integer and prefers the thumbnail", () => {
  expect(toSelectedImage(asset())).toEqual({ id: 42, name: "hero.png", previewUrl: "t.jpg" });
});

test("toSelectedImage falls back to url when no thumbnail", () => {
  expect(toSelectedImage(asset({ thumbnailUrl: undefined })).previewUrl).toBe("u.jpg");
});

test("toSelectedImage coerces a non-string id", () => {
  expect(toSelectedImage(asset({ id: "007" })).id).toBe(7);
});

test("selectionsToInputs emits a bare int sourceAssetId per selected field", () => {
  expect(selectionsToInputs({ hero: toSelectedImage(asset()) }, ["hero"])).toEqual({ hero: 42 });
});

test("selectionsToInputs omits unselected fields", () => {
  expect(selectionsToInputs({}, ["hero"])).toEqual({});
});

test("selectionsToInputs ignores selections not in fieldNames", () => {
  const sel = { hero: toSelectedImage(asset()), extra: toSelectedImage(asset({ id: "9" })) };
  expect(selectionsToInputs(sel, ["hero"])).toEqual({ hero: 42 });
});

test("selectionsToInputs drops NaN ids (non-numeric asset id)", () => {
  expect(selectionsToInputs({ hero: { id: Number("nope"), name: "bad" } }, ["hero"])).toEqual({});
});
