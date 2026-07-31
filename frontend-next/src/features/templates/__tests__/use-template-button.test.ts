/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import {
  buildTemplateParams,
  deriveMediaType,
  studioRouteFor,
} from "../components/use-template-button";
import type { MediaTemplateResponse } from "../types";

const base = (over: Partial<MediaTemplateResponse> = {}): MediaTemplateResponse =>
  ({
    id: 1,
    name: "t",
    description: "d",
    mimeType: "image/png",
    generationParameters: {},
    ...over,
  }) as MediaTemplateResponse;

test("deriveMediaType: maps backend mimeType to studio media type", () => {
  expect(deriveMediaType("video/mp4")).toBe("video");
  expect(deriveMediaType("audio/mpeg")).toBe("audio");
  expect(deriveMediaType("image/png")).toBe("image");
  expect(deriveMediaType(undefined)).toBeUndefined();
});

test("studioRouteFor: routes by mimeType (video/audio → dedicated studios, else image home)", () => {
  expect(studioRouteFor("video/mp4")).toBe("/video");
  expect(studioRouteFor("audio/mpeg")).toBe("/audio");
  expect(studioRouteFor("image/png")).toBe("/");
  expect(studioRouteFor(undefined)).toBe("/");
});

test("buildTemplateParams: hydrates from generationParameters (real backend shape)", () => {
  const template = base({
    mimeType: "video/mp4",
    generationParameters: {
      prompt: "a sunset",
      model: "veo-3.1-generate-001",
      aspectRatio: "16:9",
      style: "Cinematic",
      lighting: "Golden Hour",
      colorAndTone: "Warm",
      composition: "Wide angle",
      negativePrompt: "blurry",
    },
  });
  const params = buildTemplateParams(template);
  expect(params.get("templateId")).toBe("1");
  expect(params.get("prompt")).toBe("a sunset");
  expect(params.get("model")).toBe("veo-3.1-generate-001");
  expect(params.get("aspectRatio")).toBe("16:9");
  expect(params.get("style")).toBe("Cinematic");
  expect(params.get("lighting")).toBe("Golden Hour");
  expect(params.get("colorAndTone")).toBe("Warm");
  expect(params.get("composition")).toBe("Wide angle");
  expect(params.get("negativePrompt")).toBe("blurry");
});

test("buildTemplateParams: forwards source asset ids (enriched preferred)", () => {
  const template = base({
    enrichedSourceAssets: [{ assetId: 3, role: "input", presignedUrl: "u3", gcsUri: "g3" }],
    sourceAssets: [{ assetId: 5, role: "input" }],
  });
  expect(buildTemplateParams(template).get("sourceAssetIds")).toBe("3");
});

test("buildTemplateParams: forwards source asset ids (plain when no enriched)", () => {
  const template = base({
    sourceAssets: [{ assetId: 7, role: "input" }, { assetId: 9, role: "input" }],
  });
  expect(buildTemplateParams(template).get("sourceAssetIds")).toBe("7,9");
});

test("buildTemplateParams: omits empty/optional fields", () => {
  const params = buildTemplateParams(base());
  expect(params.get("templateId")).toBe("1");
  expect(params.get("prompt")).toBeNull();
  expect(params.get("model")).toBeNull();
  expect(params.get("sourceAssetIds")).toBeNull();
});

test("buildTemplateParams: drops non-numeric asset ids", () => {
  const template = base({
    sourceAssets: [{ assetId: Number.NaN, role: "input" }, { assetId: 11, role: "input" }],
  });
  expect(buildTemplateParams(template).get("sourceAssetIds")).toBe("11");
});
