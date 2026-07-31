/** Copyright 2026 Google LLC — Apache-2.0 */

/**
 * Public video capability contract mirrored from
 * `backend/src/generation_options/dto/video_generation_options_dto.py`.
 * Backend serializes with camelCase aliases (`alias_generator=to_camel`).
 */
export type VideoCapabilities = {
  textToVideo: boolean;
  imageToVideo: boolean;
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  maxOutputs: number;
};

export type ModelDefaults = {
  durationSeconds: number | null;
  aspectRatio: string | null;
  resolution: string | null;
};

export type VideoModelOption = {
  modelKey: string;
  displayName: string;
  vendorModelId: string;
  providerKey: string;
  providerType: string;
  environment: string;
  priority: number;
  capabilities: VideoCapabilities;
  defaults: ModelDefaults;
};

export type VideoGenerationOptions = {
  defaultModelKey: string | null;
  models: VideoModelOption[];
};

export type VideoMode =
  // Angular-parity modes (flow-prompt-box mode menu).
  | "text-to-video"
  | "frames-to-video"
  | "ingredients-to-video"
  | "extend-video"
  | "concatenate-video"
  // Legacy pre-parity modes — kept so persisted localStorage normalizes cleanly.
  | "first-frame"
  | "last-frame"
  | "reference";

export type VideoGenerationRequest = {
  workspaceId: number;
  generationModel: string;
  mode: VideoMode;
  prompt: string;
  resolution?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  outputCount?: number;
  generateAudio?: boolean;
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
  referenceAssetIds?: string[];
  negativePrompt?: string;
  // Additive (parity with Angular VeoRequest + flow-prompt-box option toolbar).
  style?: string;
  colorAndTone?: string;
  lighting?: string;
  composition?: string;
  useBrandGuidelines?: boolean;
  enhancePrompt?: boolean;
  negativePhrases?: string[];
  referenceVideoAssetId?: string;
  referenceAudioAssetId?: string;
  parentMediaItemId?: string;
};

export type VideoGenerationResponse = { mediaItemId: string };

export const FALLBACK_RESOLUTIONS = ["1K", "2K", "4K"];
export const FALLBACK_DURATIONS = [5, 8];
export const FALLBACK_ASPECT_RATIOS = ["16:9", "9:16", "1:1"];
