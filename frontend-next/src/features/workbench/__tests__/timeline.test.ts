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

import { clipsAtTime, moveClip, toRenderRequest, totalDuration, validateTimeline, toggleTrack, trackKey, visibleClips } from "../timeline";
import type { Clip, Timeline } from "../types";

const videoClip: Clip = {
  id: "video-1",
  assetId: "asset-1",
  url: "https://example.test/video.mp4",
  startTime: 2,
  duration: 5,
  offset: 0,
  trackIndex: 0,
  type: "video",
};

test("calculates duration and active clips", () => {
  const audioClip = { ...videoClip, id: "audio-1", offset: 3, duration: 4, type: "audio" as const };
  expect(totalDuration([videoClip, audioClip])).toBe(7);
  expect(clipsAtTime([videoClip, audioClip], 3)).toEqual([videoClip, audioClip]);
  expect(clipsAtTime([videoClip, audioClip], 5)).toEqual([audioClip]);
});

test("finds overlapping clips on same typed track", () => {
  const overlap = { ...videoClip, id: "video-2", offset: 4 };
  const audio = { ...videoClip, id: "audio-1", type: "audio" as const, offset: 4 };
  expect(validateTimeline([videoClip, overlap, audio])).toEqual(["Clips video-1 and video-2 overlap on video:0."]);
});

test("moves clips without mutating source", () => {
  const moved = moveClip([videoClip], "video-1", 8);
  expect(moved).toEqual([{ ...videoClip, offset: 8 }]);
  expect(moved).not.toBe([videoClip]);
  expect(videoClip.offset).toBe(0);
});

test("maps timeline to backend render schema", () => {
  const timeline: Timeline = { clips: [videoClip], durationSeconds: 5 };
  expect(toRenderRequest(timeline)).toEqual({
    clips: [{ asset_id: "asset-1", url: "https://example.test/video.mp4", start_time: 2, duration: 5, offset: 0, track_index: 0, type: "video" }],
    output_format: "mp4",
  });
});

test("trackKey distinguishes type and index", () => {
  expect(trackKey("video", 0)).toBe("video:0");
  expect(trackKey("audio", 0)).toBe("audio:0");
  expect(trackKey("video", 1)).not.toBe(trackKey("video", 0));
});

test("toggleTrack adds then removes without mutating input", () => {
  const empty: ReadonlySet<string> = new Set();
  const added = toggleTrack(empty, "video:0");
  expect([...added]).toEqual(["video:0"]);
  expect(empty.size).toBe(0);
  const removed = toggleTrack(added, "video:0");
  expect([...removed]).toEqual([]);
  expect(added.size).toBe(1);
});

test("visibleClips drops clips on hidden tracks", () => {
  const audioClip = { ...videoClip, id: "audio-1", type: "audio" as const, trackIndex: 0 };
  const hidden = new Set([trackKey("video", 0)]);
  expect(visibleClips([videoClip, audioClip], hidden)).toEqual([audioClip]);
  expect(visibleClips([videoClip, audioClip], new Set())).toHaveLength(2);
});
