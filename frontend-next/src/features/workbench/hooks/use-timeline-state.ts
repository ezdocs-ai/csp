"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useCallback, useMemo, useState } from "react";
import { moveClip, removeClip, splitClip, trimEnd, trimStart, validateTimeline } from "@/src/features/workbench";
import type { Clip, Timeline } from "@/src/features/workbench";

type TrimEdge = "start" | "end";

export function useTimelineState(initialTimeline: Timeline = { clips: [], durationSeconds: 0, outputFormat: "mp4" }) {
  const [timeline, setTimeline] = useState<Timeline>(initialTimeline);
  const setClips = useCallback((clips: Clip[]) => setTimeline((current) => ({ ...current, clips })), []);
  const addClip = useCallback((clip: Clip) => setClips([...timeline.clips, clip]), [setClips, timeline.clips]);
  const remove = useCallback((clipId: string) => setClips(removeClip(timeline.clips, clipId)), [setClips, timeline.clips]);
  const move = useCallback((clipId: string, offset: number) => setClips(moveClip(timeline.clips, clipId, Math.max(0, offset))), [setClips, timeline.clips]);
  const trimClip = useCallback((clipId: string, edge: TrimEdge, time: number) => setClips(timeline.clips.map((clip) => clip.id !== clipId ? clip : edge === "start" ? trimStart(clip, time) : trimEnd(clip, time))), [setClips, timeline.clips]);
  const split = useCallback((clipId: string, atTime: number) => setClips(splitClip(timeline.clips, clipId, atTime)), [setClips, timeline.clips]);
  const errors = useMemo(() => validateTimeline(timeline.clips), [timeline.clips]);

  return { timeline, addClip, removeClip: remove, moveClip: move, trimClip, splitClip: split, setClips, errors };
}
