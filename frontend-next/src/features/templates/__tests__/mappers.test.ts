/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { filterTemplates, previewUrlFor, uniqueIndustries } from "../mappers";
import { EMPTY_TEMPLATE_FILTER, type MediaTemplateResponse } from "../types";

const mk = (over: Partial<MediaTemplateResponse>): MediaTemplateResponse =>
  ({
    id: 1,
    name: "Template",
    description: "d",
    mimeType: "image/png",
    tags: [],
    generationParameters: {},
    ...over,
  }) as MediaTemplateResponse;

const list: MediaTemplateResponse[] = [
  mk({ id: 1, name: "Cinematic Ad", industry: "Automotive", mimeType: "video/mp4", tags: ["cinematic"], generationParameters: { model: "veo-3.1-generate-001" }, presignedUrls: ["u1"], presignedThumbnailUrls: ["t1"] }),
  mk({ id: 2, name: "Sunny Shot", industry: "Food & Beverage", mimeType: "image/png", tags: ["vibrant"], generationParameters: { model: "gemini-3-pro-image" } }),
  mk({ id: 3, name: "Jingle", industry: "Entertainment", mimeType: "audio/mpeg", tags: ["upbeat"], generationParameters: { model: "lyria-002" } }),
];

test("filterTemplates: empty filter returns all", () => {
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER })).toHaveLength(3);
});

test("filterTemplates: industry exact match", () => {
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, industry: "Automotive" }).map((t) => t.id)).toEqual([1]);
});

test("filterTemplates: mediaType exact match", () => {
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, mediaType: "audio/mpeg" }).map((t) => t.id)).toEqual([3]);
});

test("filterTemplates: name case-insensitive includes", () => {
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, name: "cinema" }).map((t) => t.id)).toEqual([1]);
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, name: "SHOT" }).map((t) => t.id)).toEqual([2]);
});

test("filterTemplates: model case-insensitive includes", () => {
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, model: "veo" }).map((t) => t.id)).toEqual([1]);
});

test("filterTemplates: tags case-insensitive includes", () => {
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, tags: "VIBRANT" }).map((t) => t.id)).toEqual([2]);
});

test("filterTemplates: multiple filters combine (AND)", () => {
  expect(
    filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, mediaType: "image/png", name: "sunny" }).map((t) => t.id),
  ).toEqual([2]);
});

test("filterTemplates: no match returns empty", () => {
  expect(filterTemplates(list, { ...EMPTY_TEMPLATE_FILTER, name: "zzz" })).toEqual([]);
});

test("uniqueIndustries: sorted unique present values, omits null", () => {
  expect(uniqueIndustries([...list, mk({ id: 4, industry: undefined })])).toEqual([
    "Automotive",
    "Entertainment",
    "Food & Beverage",
  ]);
});

test("previewUrlFor: prefers thumbnail over main", () => {
  expect(previewUrlFor(mk({ presignedUrls: ["main"], presignedThumbnailUrls: ["thumb"] }))).toBe("thumb");
  expect(previewUrlFor(mk({ presignedUrls: ["main"] }))).toBe("main");
  expect(previewUrlFor(mk({}))).toBeUndefined();
});
