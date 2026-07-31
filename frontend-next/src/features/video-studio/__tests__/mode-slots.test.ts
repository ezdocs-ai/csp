/** Copyright 2026 Google LLC — Apache-2.0 */

import assert from "node:assert/strict";
import { test } from "bun:test";

import { modeSlotConfig } from "../components/mode-slots";

test("text-to-video has no slots", () => {
  assert.deepEqual(modeSlotConfig("text-to-video"), { slots: [], showDivider: false });
});

test("frames-to-video renders two image slots with a divider", () => {
  const result = modeSlotConfig("frames-to-video");
  assert.equal(result.slots.length, 2);
  assert.equal(result.showDivider, true);
  assert.ok(result.slots.every((slot) => slot.kind === "image"));
  assert.equal(result.slots[0].id, "start");
  assert.equal(result.slots[1].id, "end");
});

test("concatenate-video renders two video slots with a divider", () => {
  const result = modeSlotConfig("concatenate-video");
  assert.equal(result.slots.length, 2);
  assert.equal(result.showDivider, true);
  assert.ok(result.slots.every((slot) => slot.kind === "video"));
});

test("extend-video renders a single video slot without a divider", () => {
  const result = modeSlotConfig("extend-video");
  assert.equal(result.slots.length, 1);
  assert.equal(result.showDivider, false);
  assert.equal(result.slots[0].kind, "video");
});

test("ingredients-to-video renders N image ref slots and a max badge", () => {
  const result = modeSlotConfig("ingredients-to-video", { maxReferenceImages: 3 });
  assert.equal(result.max, 3);
  assert.equal(result.slots.length, 3);
  assert.ok(result.slots.every((slot) => slot.kind === "image"));
  assert.equal(result.slots[0].id, "ref-0");
});

test("ingredients-to-video on Gemini Omni appends video + audio ref slots", () => {
  const result = modeSlotConfig("ingredients-to-video", { maxReferenceImages: 2, isOmni: true });
  assert.equal(result.slots.length, 4);
  assert.equal(result.slots[2].id, "ref-video");
  assert.equal(result.slots[2].kind, "video");
  assert.equal(result.slots[3].id, "ref-audio");
  assert.equal(result.slots[3].kind, "audio");
});

test("unknown mode falls back to empty", () => {
  assert.deepEqual(modeSlotConfig("legacy-mode"), { slots: [], showDivider: false });
});
