/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, test } from "bun:test";

import { splitClip, removeClip, trimEnd, trimStart, canSplitAt } from "../trim";
import type { Clip } from "../types";

const clip: Clip = {
  id: "clip-1",
  assetId: "asset-1",
  url: "https://example.test/video.mp4",
  startTime: 10,
  duration: 8,
  offset: 4,
  trackIndex: 0,
  type: "video",
};

test("trims start and end without mutation", () => {
  expect(trimStart(clip, 12)).toEqual({ ...clip, startTime: 12, duration: 6 });
  expect(trimEnd(clip, 15)).toEqual({ ...clip, duration: 5 });
  expect(clip).toEqual({ ...clip, startTime: 10, duration: 8 });
});

test("splits a clip at timeline time", () => {
  const result = splitClip([clip], "clip-1", 9);
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ ...clip, duration: 5 });
  expect(result[1]).toMatchObject({
    assetId: "asset-1",
    startTime: 15,
    duration: 3,
    offset: 9,
  });
  expect(result[1].id).toStartWith("clip-1-");
  expect(result[0].duration + result[1].duration).toBe(clip.duration);
});

test("removes clip immutably", () => {
  expect(removeClip([clip], "clip-1")).toEqual([]);
  expect(removeClip([clip], "missing")).toEqual([clip]);
});

test("canSplitAt only allows playhead strictly inside the clip", () => {
  // clip occupies timeline interval [4, 12).
  expect(canSplitAt([clip], "clip-1", 4)).toBe(false); // at start edge
  expect(canSplitAt([clip], "clip-1", 4.05)).toBe(false); // within 0.1s epsilon
  expect(canSplitAt([clip], "clip-1", 12)).toBe(false); // at end edge
  expect(canSplitAt([clip], "clip-1", 11.95)).toBe(false); // within 0.1s epsilon
  expect(canSplitAt([clip], "clip-1", 9)).toBe(true); // mid-clip
  expect(canSplitAt([clip], "missing", 9)).toBe(false); // unknown id
  expect(canSplitAt([], "clip-1", 9)).toBe(false); // empty list
});
