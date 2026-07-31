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

/** User-facing resolution aliases. Match CreateVeoDto.resolution on the
 * backend; VeoAdapter maps these to provider literals (1K->720p,
 * 2K->1080p, 4K->4k) at submit time via VIDEO_RESOLUTION_MAP.
 */
export type VideoResolution = '1K' | '2K' | '4K';

export interface VideoModelCapabilities {
  textToVideo: boolean;
  imageToVideo: boolean;
  referenceImages: boolean;
  durations: number[];
  aspectRatios: string[];
  resolutions: VideoResolution[];
  maxOutputs: number;
}

export interface VideoModelDefaults {
  durationSeconds: number;
  aspectRatio: string;
  resolution: VideoResolution;
}

export interface VideoModelOption {
  modelKey: string;
  displayName: string;
  vendorModelId: string;
  providerKey: string;
  providerType: string;
  environment: string;
  priority: number;
  capabilities: VideoModelCapabilities;
  defaults: VideoModelDefaults;
}

export interface VideoGenerationOptions {
  defaultModelKey: string;
  models: VideoModelOption[];
}
