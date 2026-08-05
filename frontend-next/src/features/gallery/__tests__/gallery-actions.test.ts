/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0 */
import { expect, test } from "bun:test";

import {
  buildConcatenate,
  buildEditWithOmni,
  buildExtendWithAi,
  buildImageRemix,
  buildSendToVto,
  buildVideoEnd,
  buildVideoStart,
  isAudioMedia,
  isImageMedia,
  isVideoMedia,
  mediaKind,
} from "../gallery-actions";
import type { MediaDetail } from "../types";

const media = (over: Partial<MediaDetail> = {}): MediaDetail =>
  ({
    id: 42,
    workspaceId: 1,
    userEmail: "u@example.com",
    mimeType: "image/png",
    model: "gemini-3.1-flash-lite-image",
    aspectRatio: "1:1",
    status: "completed",
    gcsUris: ["gs://bucket/42.png"],
    presignedUrls: ["https://signed/42.png"],
    presignedThumbnailUrls: ["https://signed/42-thumb.png"],
    prompt: "a red cat",
    originalPrompt: "original red cat",
    ...over,
  }) as MediaDetail;

test("mediaKind classifies mime prefixes", () => {
  expect(mediaKind("image/png")).toBe("image");
  expect(mediaKind("video/mp4")).toBe("video");
  expect(mediaKind("audio/mpeg")).toBe("audio");
  expect(mediaKind("application/json")).toBeNull();
  expect(mediaKind(undefined)).toBeNull();
  expect(mediaKind("")).toBeNull();
});

test("predicates mirror Angular getters (isImage gates edit/video/vto)", () => {
  expect(isImageMedia("image/jpeg")).toBe(true);
  expect(isVideoMedia("image/jpeg")).toBe(false);
  expect(isVideoMedia("video/mp4")).toBe(true);
  expect(isAudioMedia("audio/wav")).toBe(true);
});

test("buildImageRemix: prompt carried in URL the image studio consumes + staged refs", () => {
  const intent = buildImageRemix(media());
  expect(intent.route).toBe("/?prompt=a%20red%20cat");
  expect(intent.remixState.sourceMediaItems).toEqual([
    { mediaItemId: 42, mediaIndex: 0, role: "input" },
  ]);
  expect(intent.remixState.prompt).toBe("a red cat");
  expect(intent.remixState.previewUrl).toBe("https://signed/42.png");
});

test("buildImageRemix: omits query when no prompt", () => {
  expect(buildImageRemix(media({ prompt: "" })).route).toBe("/");
  expect(buildImageRemix(media({ prompt: null })).route).toBe("/");
});

test("buildVideoStart: start_frame role + start preview only", () => {
  const intent = buildVideoStart(media());
  expect(intent.route).toBe("/video");
  expect(intent.remixState.sourceMediaItems).toEqual([
    { mediaItemId: 42, mediaIndex: 0, role: "start_frame" },
  ]);
  expect(intent.remixState.startImagePreviewUrl).toBe("https://signed/42.png");
  expect(intent.remixState.endImagePreviewUrl).toBeUndefined();
});

test("buildVideoEnd: end_frame role + end preview only", () => {
  const intent = buildVideoEnd(media());
  expect(intent.remixState.sourceMediaItems).toEqual([
    { mediaItemId: 42, mediaIndex: 0, role: "end_frame" },
  ]);
  expect(intent.remixState.startImagePreviewUrl).toBeUndefined();
  expect(intent.remixState.endImagePreviewUrl).toBe("https://signed/42.png");
});

test("buildSendToVto: model image fields", () => {
  const intent = buildSendToVto(media());
  expect(intent.route).toBe("/vto");
  expect(intent.remixState).toMatchObject({
    modelImageAssetId: 42,
    modelImagePreviewUrl: "https://signed/42.png",
    modelImageMediaIndex: 0,
    modelImageGcsUri: "gs://bucket/42.png",
  });
});

test("buildEditWithOmni: video path seeds referenceVideo + omni flags", () => {
  const intent = buildEditWithOmni(media({ mimeType: "video/mp4" }));
  expect(intent.route).toBe("/video");
  expect(intent.remixState.generationModel).toBe("gemini-omni");
  expect(intent.remixState.isOmniMode).toBe(true);
  expect(intent.remixState.parentMediaItemId).toBe(42);
  expect(intent.remixState.referenceVideo).toMatchObject({
    id: 42,
    type: "media_item",
    index: 0,
    name: "original red cat",
    previewUrl: "https://signed/42-thumb.png",
  });
  expect(intent.remixState.referenceAudio).toBeUndefined();
});

test("buildEditWithOmni: audio path seeds referenceAudio (name falls back)", () => {
  const intent = buildEditWithOmni(
    media({ mimeType: "audio/mpeg", originalPrompt: null }),
  );
  expect(intent.remixState.referenceAudio).toMatchObject({
    id: 42,
    type: "media_item",
    index: 0,
  });
  // remixState is an untyped sessionStorage payload (Record<string, unknown>).
  expect(String((intent.remixState.referenceAudio as { name?: unknown }).name)).toContain("Audio Input");
  expect(intent.remixState.referenceVideo).toBeUndefined();
});

test("buildExtendWithAi: extension source role + Veo 3.1 + thumbnail preview", () => {
  const intent = buildExtendWithAi(media({ mimeType: "video/mp4" }));
  expect(intent.route).toBe("/video");
  expect(intent.remixState.sourceMediaItems).toEqual([
    { mediaItemId: 42, mediaIndex: 0, role: "video_extension_source" },
  ]);
  expect(intent.remixState.generationModel).toBe("veo-3.1-generate-001");
  expect(intent.remixState.startImagePreviewUrl).toBe("https://signed/42-thumb.png");
});

test("buildConcatenate: concatenation source role + startConcatenation flag", () => {
  const intent = buildConcatenate(media({ mimeType: "video/mp4" }));
  expect(intent.route).toBe("/video");
  expect(intent.remixState.sourceMediaItems).toEqual([
    { mediaItemId: 42, mediaIndex: 0, role: "concatenation_source" },
  ]);
  expect(intent.remixState.startConcatenation).toBe(true);
});
