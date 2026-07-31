/** Copyright 2026 Google LLC — Apache-2.0 */
/**
 * Pure gallery filter helpers — option lists and URL-param encode/decode.
 * Mirrors Angular `MediaGalleryComponent` model/media-type/asset-type/tag
 * anatomy. No DOM/React imports; tested in `__tests__/gallery-filters.test.ts`.
 */

export type GenerationType = "IMAGE" | "VIDEO" | "AUDIO" | "TEXT";

export interface ModelOption {
  value: string;
  label: string;
  type: GenerationType;
}

/** Matches Angular `MODEL_CONFIGS` (value / viewValue / type). */
export const MODEL_OPTIONS: ModelOption[] = [
  { value: "gemini-3.1-flash-image", label: "Nano Banana 2", type: "IMAGE" },
  { value: "gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite", type: "IMAGE" },
  { value: "gemini-3-pro-image", label: "Nano Banana Pro", type: "IMAGE" },
  { value: "gemini-2.5-flash-image", label: "Nano Banana", type: "IMAGE" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", type: "TEXT" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", type: "TEXT" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", type: "TEXT" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", type: "TEXT" },
  { value: "gemini-omni-flash-preview", label: "Gemini Omni Flash", type: "VIDEO" },
  { value: "veo-3.1-generate-001", label: "Veo 3.1", type: "VIDEO" },
  { value: "veo-3.1-lite-generate-001", label: "Veo 3.1 Lite (Preview)", type: "VIDEO" },
  { value: "veo-3.1-fast-generate-001", label: "Veo 3.1 Fast", type: "VIDEO" },
  { value: "lyria-002", label: "Lyria", type: "AUDIO" },
  { value: "gemini-2.5-flash-tts", label: "Gemini TTS", type: "AUDIO" },
  { value: "chirp_3", label: "Chirp", type: "AUDIO" },
];

export const MEDIA_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "image/*", label: "Image" },
  { value: "video/*", label: "Video" },
  { value: "audio/*", label: "Audio" },
];

export const ASSET_TYPE_OPTIONS = [
  { value: "", label: "All Assets" },
  { value: "media_item", label: "Generated Media" },
  { value: "source_asset", label: "Uploaded Assets" },
];

const MEDIA_TYPE_TO_GENERATION: Record<string, GenerationType> = {
  "image/*": "IMAGE",
  "video/*": "VIDEO",
  "audio/*": "AUDIO",
};

/**
 * Angular `modelOptions` getter: when a media-type wildcard is active, show only
 * models of that type; otherwise (All Types) show every model. Always prepends
 * an "All Models" sentinel.
 */
export function filterModelOptions(
  mediaType: string | null | undefined,
): { value: string; label: string }[] {
  const targetType = mediaType ? MEDIA_TYPE_TO_GENERATION[mediaType] : undefined;
  const filtered = targetType
    ? MODEL_OPTIONS.filter((m) => m.type === targetType)
    : MODEL_OPTIONS;
  return [{ value: "", label: "All Models" }, ...filtered.map(({ value, label }) => ({ value, label }))];
}

/**
 * Angular `onMediaTypeChange` reset guard: returns false when the current model
 * value is not offered for the selected media type (so the caller should clear
 * it). An empty model is always "valid" (All Models).
 */
export function isModelValidForType(model: string | null | undefined, mediaType: string | null | undefined): boolean {
  if (!model) return true;
  return filterModelOptions(mediaType).some((o) => o.value === model);
}

/** Parse a comma-separated `tags` URL param into a de-duplicated name list. */
export function parseTagsParam(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(",")) {
    const name = raw.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Serialize a tag-name list back into the comma-separated URL param form. */
export function serializeTagsParam(tags: string[]): string {
  return tags.filter(Boolean).join(",");
}

/** Toggle membership of a single tag name within a list (returns a new array). */
export function toggleTag(tags: string[], name: string): string[] {
  return tags.includes(name) ? tags.filter((t) => t !== name) : [...tags, name];
}
