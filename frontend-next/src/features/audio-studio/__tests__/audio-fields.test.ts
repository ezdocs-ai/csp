/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { audioFieldsFor } from "../types";

test("audioFieldsFor: lyria shows music fields, hides TTS fields", () => {
  const f = audioFieldsFor("lyria");
  expect(f.prompt).toBe(true);
  expect(f.negativePrompt).toBe(true);
  expect(f.seed).toBe(true);
  expect(f.sampleCount).toBe(true);
  expect(f.text).toBe(false);
  expect(f.language).toBe(false);
  expect(f.voice).toBe(false);
});

test("audioFieldsFor: chirp + gemini-tts show TTS fields, hide music-only fields", () => {
  for (const model of ["chirp", "gemini-tts"] as const) {
    const f = audioFieldsFor(model);
    expect(f.text).toBe(true);
    expect(f.language).toBe(true);
    expect(f.voice).toBe(true);
    expect(f.sampleCount).toBe(true);
    expect(f.negativePrompt).toBe(false);
    expect(f.seed).toBe(false);
  }
});
