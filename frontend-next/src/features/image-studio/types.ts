/** Copyright 2026 Google LLC — Apache-2.0 */
import type { JobStatus } from "@/src/lib/hooks/use-media-job";

export interface ImageOptions {
  generation_models: string[];
  aspect_ratios: string[];
  styles: string[];
  lightings: string[];
  colors_and_tones: string[];
  composition: string[];
  numbers_of_images: number[];
}

export type ImageMode = "Text to Image" | "Ingredients to Image";

/** A reference image carried into Ingredients mode (source-asset backed). */
export interface ReferenceImage {
  id: string;
  previewUrl?: string;
  label?: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  workspaceId: number;
  generationModel: string;
  aspectRatio: string;
  numberOfMedia: number;
  style: string | null;
  negativePrompt: string;
  colorAndTone: string | null;
  lighting: string | null;
  composition: string | null;
  addWatermark: boolean;
  resolution: "1K" | "2K" | "4K";
  sourceAssetIds?: number[];
  // Additive (Wave 3 parity): contextual toggles + mode + reference images.
  googleSearch: boolean;
  useBrandGuidelines: boolean;
  enhancePrompt: boolean;
  mode: ImageMode;
  referenceImages?: ReferenceImage[];
}

export interface ImageJob {
  id: number;
  status: JobStatus;
  gcsUris?: string[];
  presignedUrls?: string[];
  errorMessage?: string | null;
}

export const IMAGE_MODEL_OPTIONS = [
  { value: "gemini-3.1-flash-image", label: "Nano Banana 2" },
  { value: "gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite" },
  { value: "gemini-3-pro-image", label: "Nano Banana Pro" },
  { value: "gemini-2.5-flash-image", label: "Nano Banana" },
] as const;

export const defaultImageState: Omit<ImageGenerationRequest, "workspaceId"> = {
  prompt: "",
  generationModel: "gemini-3.1-flash-lite-image",
  aspectRatio: "1:1",
  numberOfMedia: 4,
  style: null,
  negativePrompt: "",
  colorAndTone: null,
  lighting: null,
  composition: null,
  addWatermark: false,
  resolution: "1K",
  googleSearch: false,
  useBrandGuidelines: false,
  enhancePrompt: false,
  mode: "Text to Image",
};

/**
 * Aspect-ratio → human label. Mirrors Angular `home.component.ts`
 * `aspectRatioOptions[*].viewValue` (the second token after the ratio).
 * The backend `/api/images?options=1` returns raw ratio tokens only, so this
 * map restores the Angular labels for the FlowPromptBox settings dropdown.
 */
export const RATIO_LABELS: Record<string, string> = {
  "1:1": "Square",
  "16:9": "Horizontal",
  "9:16": "Vertical",
  "3:4": "Portrait",
  "4:3": "Pin",
  "2:3": "Portrait",
  "3:2": "Landscape",
  "4:5": "Portrait",
  "5:4": "Landscape",
  "21:9": "Wide",
  "1:4": "Skyscraper",
  "4:1": "Banner",
  "1:8": "Tall Ribbon",
  "8:1": "Wide Ribbon",
};

/** Format a raw ratio token as "{ratio} {label}" (Angular viewValue parity). */
export function formatRatioLabel(ratio: string): string {
  const label = RATIO_LABELS[ratio];
  return label ? `${ratio} ${label}` : ratio;
}

const GOOGLE_SEARCH_MODELS = new Set([
  "gemini-3-pro-image",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
]);

/**
 * The Google Search toolbar toggle renders ONLY for these models
 * (Angular `home.component.html` L322 gating condition).
 */
export function isGoogleSearchEligible(model: string): boolean {
  return GOOGLE_SEARCH_MODELS.has(model);
}
