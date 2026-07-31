/** Copyright 2026 Google LLC — Apache-2.0 */

import type { Clip } from "./types";

export function trimStart(clip: Clip, newStartTime: number): Clip {
  const startTime = Math.min(Math.max(newStartTime, clip.startTime), clip.startTime + clip.duration);
  return { ...clip, startTime, duration: clip.duration - (startTime - clip.startTime) };
}

export function trimEnd(clip: Clip, newEndTime: number): Clip {
  const endTime = Math.max(newEndTime, clip.startTime);
  return { ...clip, duration: endTime - clip.startTime };
}

export function splitClip(clips: Clip[], clipId: string, atTime: number): Clip[] {
  return clips.flatMap((clip) => {
    if (clip.id !== clipId || atTime <= clip.offset || atTime >= clip.offset + clip.duration) {
      return clip;
    }

    const firstDuration = atTime - clip.offset;
    return [
      { ...clip, duration: firstDuration },
      {
        ...clip,
        id: `${clip.id}-${crypto.randomUUID()}`,
        startTime: clip.startTime + firstDuration,
        duration: clip.duration - firstDuration,
        offset: atTime,
      },
    ];
  });
}

export function removeClip(clips: Clip[], clipId: string): Clip[] {
  return clips.filter((clip) => clip.id !== clipId);
}

// Parity check for the split button: playhead must sit strictly inside the
// selected clip with a 0.1s epsilon on each edge so we never emit a zero-length
// clip. Mirrors Angular's `canSplit()` predicate.
export function canSplitAt(clips: Clip[], clipId: string, atTime: number): boolean {
  const clip = clips.find((candidate) => candidate.id === clipId);
  if (!clip) return false;
  return atTime > clip.offset + 0.1 && atTime < clip.offset + clip.duration - 0.1;
}
