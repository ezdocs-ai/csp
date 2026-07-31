// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { describe, expect, it } from "bun:test";
import { EMPTY_FORM, formToCreateBody, formToUpdateBody, parseOptionsJson, parseTags, templateToForm, type Template } from "./template-mappers";

describe("parseTags", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseTags("a, b , ,c")).toEqual(["a", "b", "c"]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags("   ")).toEqual([]);
  });
});

describe("parseOptionsJson", () => {
  it("parses a JSON object", () => {
    expect(parseOptionsJson('{"prompt":"hi"}')).toEqual({ prompt: "hi" });
  });
  it("throws on invalid JSON", () => {
    expect(() => parseOptionsJson("{not json")).toThrow("Options must be valid JSON.");
  });
  it("rejects non-object payloads", () => {
    expect(parseOptionsJson("[]")).toEqual({});
    expect(parseOptionsJson('"x"')).toEqual({});
    expect(parseOptionsJson("42")).toEqual({});
  });
});

describe("templateToForm", () => {
  it("maps backend camelCase to form, pulls model out of options", () => {
    const t: Template = {
      id: 1,
      name: "Rolex",
      description: "Ad",
      mimeType: "video/mp4",
      industry: "Luxury Goods",
      brand: "Rolex",
      tags: ["cinematic", "vibrant"],
      gcsUris: ["gs://x/a.mp4", "gs://x/b.mp4"],
      thumbnailUris: ["https://t/1.png"],
      generationParameters: { model: "veo-3.0-generate-001", prompt: "p", aspectRatio: "16:9" },
      presignedThumbnailUrls: ["signed"],
    };
    const form = templateToForm(t);
    expect(form.mediaItemId).toBe("");
    expect(form.model).toBe("veo-3.0-generate-001");
    expect(form.tags).toBe("cinematic, vibrant");
    expect(form.gcsUri).toBe("gs://x/a.mp4");
    expect(form.thumbnailUrl).toBe("https://t/1.png");
    expect(JSON.parse(form.options)).not.toHaveProperty("model");
    expect(JSON.parse(form.options).prompt).toBe("p");
  });
  it("falls back to empty strings for missing uris", () => {
    expect(templateToForm({ id: 2, name: "n" }).gcsUri).toBe("");
  });
});

describe("formToUpdateBody", () => {
  it("prunes empty fields, omits immutable mimeType, nests generationParameters", () => {
    const body = formToUpdateBody({ ...EMPTY_FORM, name: "N", description: "D", model: "veo-3.0-generate-001", tags: "a, b", options: '{"prompt":"p"}' });
    expect(body).not.toHaveProperty("mimeType");
    expect(body).not.toHaveProperty("mediaItemId");
    expect(body).not.toHaveProperty("thumbnailUris"); // empty pruned
    expect(body).not.toHaveProperty("gcsUris");
    expect(body.name).toBe("N");
    expect(body.tags).toEqual(["a", "b"]);
    expect(body.generationParameters).toEqual({ prompt: "p", model: "veo-3.0-generate-001" });
  });
  it("throws on invalid options JSON", () => {
    expect(() => formToUpdateBody({ ...EMPTY_FORM, options: "x" })).toThrow("Options must be valid JSON.");
  });
});

describe("formToCreateBody", () => {
  it("returns parsed mediaItemId when valid", () => {
    expect(formToCreateBody({ ...EMPTY_FORM, mediaItemId: "42" })).toEqual({ mediaItemId: 42 });
  });
  it("rejects non-positive / non-integer ids", () => {
    expect(() => formToCreateBody({ ...EMPTY_FORM, mediaItemId: "" })).toThrow();
    expect(() => formToCreateBody({ ...EMPTY_FORM, mediaItemId: "0" })).toThrow();
    expect(() => formToCreateBody({ ...EMPTY_FORM, mediaItemId: "-3" })).toThrow();
    expect(() => formToCreateBody({ ...EMPTY_FORM, mediaItemId: "abc" })).toThrow();
  });
});
