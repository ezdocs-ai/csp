/**
 * Copyright 2025 Google LLC
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

export enum ProviderType {
  GOOGLE_VEAN = 'GOOGLE_VEAN',
  REPLICATE = 'REPLICATE',
}

export enum MediaType {
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
}

export enum Environment {
  LOCAL = 'LOCAL',
  DEVELOPMENT = 'DEVELOPMENT',
  PRODUCTION = 'PRODUCTION',
}

export interface VideoModelCapabilities {
  textToVideo: boolean;
  imageToVideo: boolean;
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  maxOutputs: number;
}

export interface ModelDefaults {
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
}

export interface CostMetadata {
  currency?: string;
  perSecond?: number;
  notes?: string;
}

export interface AiProvider {
  id: number;
  key: string;
  displayName: string;
  providerType: ProviderType;
  enabled: boolean;
  baseUrl: string | null;
  timeoutSeconds: number | null;
  hasSecret: boolean;
  secretVersion: string | null;
}

export interface AiProviderCreate {
  key: string;
  displayName: string;
  providerType: ProviderType;
  enabled: boolean;
  secretRef: string;
  baseUrl: string | null;
  timeoutSeconds: number | null;
}

export type AiProviderUpdate = Partial<AiProviderCreate>;

export interface AiModel {
  id: number;
  key: string;
  providerId: number;
  vendorModelId: string;
  mediaType: MediaType;
  displayName: string;
  enabled: boolean;
  capabilities: VideoModelCapabilities;
  defaults: ModelDefaults;
  costMetadata: CostMetadata | null;
  environment: Environment;
  priority: number;
}

export interface AiModelCreate {
  key: string;
  providerId: number;
  vendorModelId: string;
  mediaType: MediaType;
  displayName: string;
  enabled: boolean;
  capabilities: VideoModelCapabilities;
  defaults: ModelDefaults;
  costMetadata: CostMetadata | null;
  environment: Environment;
  priority: number;
}

export type AiModelUpdate = Partial<AiModelCreate>;

export interface ProviderTestResult {
  success: boolean;
  message: string;
}
