/** Copyright 2026 Google LLC — Apache-2.0 */

import type { Clip, ClipType, RenderRequest, Timeline } from "./types";

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((duration, clip) => Math.max(duration, clip.offset + clip.duration), 0);
}

export function clipsAtTime(clips: Clip[], time: number): Clip[] {
  return clips.filter((clip) => clip.offset <= time && time < clip.offset + clip.duration);
}

export function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((left, right) => left.offset - right.offset || left.trackIndex - right.trackIndex);
}

export function validateTimeline(clips: Clip[]): string[] {
  const errors: string[] = [];
  const tracks = new Map<string, Clip[]>();

  for (const clip of clips) {
    if (!Number.isFinite(clip.offset) || clip.offset < 0) {
      errors.push(`Clip ${clip.id} has an invalid offset.`);
    }
    if (!Number.isFinite(clip.startTime) || clip.startTime < 0) {
      errors.push(`Clip ${clip.id} has an invalid start time.`);
    }
    if (!Number.isFinite(clip.duration) || clip.duration <= 0) {
      errors.push(`Clip ${clip.id} has an invalid duration.`);
    }
    if (!Number.isInteger(clip.trackIndex) || clip.trackIndex < 0) {
      errors.push(`Clip ${clip.id} has an invalid track index.`);
    }

    const key = `${clip.type}:${clip.trackIndex}`;
    tracks.set(key, [...(tracks.get(key) ?? []), clip]);
  }

  for (const [track, trackClips] of tracks) {
    const sorted = sortClips(trackClips);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const previousEnd = previous.offset + previous.duration;
      if (current.offset < previousEnd) {
        errors.push(`Clips ${previous.id} and ${current.id} overlap on ${track}.`);
      } else if (current.offset > previousEnd) {
        errors.push(`Gap on ${track} from ${previousEnd} to ${current.offset}.`);
      }
    }
  }

  return errors;
}

export function moveClip(clips: Clip[], clipId: string, newOffset: number): Clip[] {
  return clips.map((clip) => (clip.id === clipId ? { ...clip, offset: newOffset } : clip));
}

export function toRenderRequest(timeline: Timeline): RenderRequest {
  return {
    clips: timeline.clips.map(({ assetId, url, startTime, duration, offset, trackIndex, type }) => ({
      asset_id: assetId,
      url,
      start_time: startTime,
      duration,
      offset,
      track_index: trackIndex,
      type,
    })),
    output_format: timeline.outputFormat ?? "mp4",
  };
}

// Stable identity for a track slot. Video 0 and audio 0 are distinct tracks.
export function trackKey(type: ClipType, trackIndex: number): string {
  return `${type}:${trackIndex}`;
}

// Immutably toggle membership of `key` in a track-keyed set. Returns a new Set.
export function toggleTrack(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

// Filter clips whose track is hidden. Pure — used by both preview and render
// paths so visibility stays consistent.
export function visibleClips(clips: Clip[], hidden: ReadonlySet<string>): Clip[] {
  return clips.filter((clip) => !hidden.has(trackKey(clip.type, clip.trackIndex)));
}
