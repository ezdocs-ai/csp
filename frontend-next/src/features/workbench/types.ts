/** Copyright 2026 Google LLC — Apache-2.0 */

export type ClipType = "video" | "audio";

/**
 * `trackIndex` is scoped to `type`: video 0 and audio 0 are separate tracks.
 */
export type Clip = {
  id: string;
  assetId: string;
  url: string;
  startTime: number;
  duration: number;
  offset: number;
  trackIndex: number;
  type: ClipType;
  // Optional presentation data. Not fabricated by the workbench — only
  // rendered when an upstream asset already provides it.
  thumbnail?: string;
  waveform?: number[];
};

export type Timeline = {
  clips: Clip[];
  durationSeconds: number;
  outputFormat?: string;
};

export type RenderClip = {
  asset_id: string;
  url: string;
  start_time: number;
  duration: number;
  offset: number;
  track_index: number;
  type: ClipType;
};

export type RenderRequest = {
  clips: RenderClip[];
  output_format: string;
};
