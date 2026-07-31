/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { parseVideoRemix, videoRemixPatch } from "../remix-handoff";

test("parseVideoRemix rejects non-handoff shapes", () => {
  expect(parseVideoRemix(null)).toBeNull();
  expect(parseVideoRemix(undefined)).toBeNull();
  expect(parseVideoRemix("remixState")).toBeNull();
  expect(parseVideoRemix([])).toBeNull();
  expect(parseVideoRemix({})).toBeNull();
  // prompt without any media source is not a video handoff
  expect(parseVideoRemix({ prompt: "lonely" })).toBeNull();
});

test("parseVideoRemix extracts recognized fields and drops unknown/garbage", () => {
  const intent = parseVideoRemix({
    prompt: "a red cat",
    generationModel: "veo-3.1-generate-001",
    isOmniMode: false,
    startConcatenation: true,
    startImagePreviewUrl: "https://signed/42.png",
    endImagePreviewUrl: "https://signed/43.png",
    parentMediaItemId: 7,
    sourceMediaItems: [
      { mediaItemId: 42, mediaIndex: 0, role: "concatenation_source" },
      { mediaItemId: "bad", mediaIndex: 0, role: "x" }, // dropped: non-numeric id
      { role: "no-ids" }, // dropped: missing fields
    ],
    unknownCarrierField: "ignored",
  });
  expect(intent).not.toBeNull();
  expect(intent!.sourceMediaItems).toEqual([
    { mediaItemId: 42, mediaIndex: 0, role: "concatenation_source" },
  ]);
  expect(intent!.prompt).toBe("a red cat");
  expect(intent!.generationModel).toBe("veo-3.1-generate-001");
  expect(intent!.startConcatenation).toBe(true);
  expect(intent!.parentMediaItemId).toBe(7);
  expect((intent as Record<string, unknown>).unknownCarrierField).toBeUndefined();
});

test("parseVideoRemix parses Omni referenceVideo / referenceAudio", () => {
  const video = parseVideoRemix({
    isOmniMode: true,
    generationModel: "gemini-omni",
    parentMediaItemId: 42,
    referenceVideo: { id: 42, type: "media_item", index: 0, name: "v", previewUrl: "p" },
  });
  expect(video?.referenceVideo).toMatchObject({ id: 42, type: "media_item", index: 0 });
  expect(video?.referenceVideo?.previewUrl).toBe("p");

  const audio = parseVideoRemix({
    isOmniMode: true,
    referenceAudio: { id: 9, type: "media_item", index: 0, name: "a" },
  });
  expect(audio?.referenceAudio).toMatchObject({ id: 9, index: 0 });
  expect(audio?.referenceVideo).toBeUndefined();

  // malformed ref is dropped, and without any source the intent becomes null
  expect(
    parseVideoRemix({ isOmniMode: true, referenceVideo: { id: "x", type: "media_item" } }),
  ).toBeNull();
});

test("videoRemixPatch: start_frame → frames-to-video + start slot", () => {
  const intent = parseVideoRemix({
    prompt: "p",
    sourceMediaItems: [{ mediaItemId: 42, mediaIndex: 0, role: "start_frame" }],
    startImagePreviewUrl: "https://s/42.png",
  })!;
  const { statePatch, slots } = videoRemixPatch(intent, {});
  expect(statePatch.mode).toBe("frames-to-video");
  expect(statePatch.prompt).toBe("p");
  expect(slots["start"]).toEqual({ assetId: "42", previewUrl: "https://s/42.png" });
  expect(slots["end"]).toBeUndefined();
});

test("videoRemixPatch: end_frame → end slot only", () => {
  const intent = parseVideoRemix({
    sourceMediaItems: [{ mediaItemId: 42, mediaIndex: 0, role: "end_frame" }],
    endImagePreviewUrl: "https://s/42.png",
  })!;
  const { statePatch, slots } = videoRemixPatch(intent, {});
  expect(statePatch.mode).toBe("frames-to-video");
  expect(slots["end"]).toEqual({ assetId: "42", previewUrl: "https://s/42.png" });
  expect(slots["start"]).toBeUndefined();
});

test("videoRemixPatch: video_extension_source → extend-video + source slot + model", () => {
  const intent = parseVideoRemix({
    sourceMediaItems: [{ mediaItemId: 42, mediaIndex: 0, role: "video_extension_source" }],
    startImagePreviewUrl: "https://s/42.png",
    generationModel: "veo-3.1-generate-001",
  })!;
  const { statePatch, slots } = videoRemixPatch(intent, {});
  expect(statePatch.mode).toBe("extend-video");
  expect(statePatch.generationModel).toBe("veo-3.1-generate-001");
  expect(slots["source"]).toEqual({ assetId: "42", previewUrl: "https://s/42.png" });
});

test("videoRemixPatch: concatenation_source → concatenate-video + first slot", () => {
  const intent = parseVideoRemix({
    sourceMediaItems: [{ mediaItemId: 42, mediaIndex: 0, role: "concatenation_source" }],
    startImagePreviewUrl: "https://s/42.png",
    startConcatenation: true,
  })!;
  const { statePatch, slots } = videoRemixPatch(intent, {});
  expect(statePatch.mode).toBe("concatenate-video");
  expect(slots["first"]).toEqual({ assetId: "42", previewUrl: "https://s/42.png" });
});

test("videoRemixPatch: Omni video → ingredients-to-video + ref-video slot + parent", () => {
  const intent = parseVideoRemix({
    isOmniMode: true,
    generationModel: "gemini-omni",
    parentMediaItemId: 42,
    referenceVideo: { id: 42, type: "media_item", index: 0, name: "v", previewUrl: "p" },
  })!;
  const { statePatch, slots } = videoRemixPatch(intent, {});
  expect(statePatch.mode).toBe("ingredients-to-video");
  expect(statePatch.generationModel).toBe("gemini-omni");
  expect(statePatch.parentMediaItemId).toBe("42");
  expect(slots["ref-video"]).toEqual({ assetId: "42", previewUrl: "p", name: "v" });
  expect(slots["ref-audio"]).toBeUndefined();
});

test("videoRemixPatch: Omni audio → ref-audio slot", () => {
  const intent = parseVideoRemix({
    isOmniMode: true,
    referenceAudio: { id: 9, type: "media_item", index: 0, name: "a" },
  })!;
  const { statePatch, slots } = videoRemixPatch(intent, {});
  expect(statePatch.mode).toBe("ingredients-to-video");
  expect(slots["ref-audio"]).toEqual({ assetId: "9", previewUrl: undefined, name: "a" });
});

test("videoRemixPatch never overwrites explicit template initialState props", () => {
  const intent = parseVideoRemix({
    prompt: "remix-prompt",
    generationModel: "gemini-omni",
    isOmniMode: true,
    parentMediaItemId: 42,
    referenceVideo: { id: 42, type: "media_item", index: 0, name: "v", previewUrl: "p" },
  })!;
  // Template explicitly set prompt, generationModel, mode, parentMediaItemId.
  const explicit = {
    prompt: "template-prompt",
    generationModel: "template-model",
    mode: "text-to-video" as const,
    parentMediaItemId: "99",
  };
  const { statePatch } = videoRemixPatch(intent, explicit);
  expect(statePatch.prompt).toBeUndefined();
  expect(statePatch.generationModel).toBeUndefined();
  expect(statePatch.mode).toBeUndefined();
  expect(statePatch.parentMediaItemId).toBeUndefined();
});

test("videoRemixPatch ignores unrecognized source role", () => {
  const intent = parseVideoRemix({
    sourceMediaItems: [{ mediaItemId: 42, mediaIndex: 0, role: "input" }],
  })!;
  const { statePatch, slots } = videoRemixPatch(intent, {});
  expect(statePatch.mode).toBeUndefined();
  expect(Object.keys(slots)).toEqual([]);
});
