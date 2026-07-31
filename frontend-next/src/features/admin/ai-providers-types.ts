/** Copyright 2026 Google LLC — Apache-2.0 */

/**
 * Mirrors `backend/src/admin/dto/ai_provider_admin_dto.py` (camelCase wire aliases).
 * Capabilities/defaults reuse the public video capability shape.
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

export type CostMetadata = {
  currency: string | null;
  perSecond: number | null;
  notes: string | null;
};

export type AiProvider = {
  id: number;
  key: string;
  displayName: string;
  providerType: string;
  enabled: boolean;
  baseUrl: string | null;
  timeoutSeconds: number;
  hasSecret: boolean;
  secretVersion: string | null;
};

export type AiProviderInput = {
  key?: string;
  displayName?: string;
  providerType?: string;
  enabled?: boolean;
  secretRef?: string | null;
  baseUrl?: string | null;
  timeoutSeconds?: number;
};

export type ProviderTestResult = {
  success: boolean;
  message: string;
};

export type AiModel = {
  id: number;
  key: string;
  providerId: number;
  vendorModelId: string;
  mediaType: string;
  displayName: string;
  enabled: boolean;
  capabilities: VideoCapabilities;
  defaults: ModelDefaults;
  costMetadata: CostMetadata | null;
  environment: string;
  priority: number;
};

export type AiModelInput = {
  key?: string;
  providerId?: number;
  vendorModelId?: string;
  mediaType?: string;
  displayName?: string;
  enabled?: boolean;
  capabilities?: VideoCapabilities;
  defaults?: ModelDefaults;
  costMetadata?: CostMetadata | null;
  environment?: string;
  priority?: number;
};
