/** Copyright 2026 Google LLC — Apache-2.0 */

/**
 * Mirrors backend `MediaTemplateModel` / `MediaTemplateResponse`
 * (`backend/src/media_templates/...`). Backend serializes camelCase
 * (`alias_generator=to_camel`, `populate_by_name=True`).
 *
 * NOTE on the two endpoints (verified against the controller):
 *  - GET /api/media-templates         → PaginationResponseDto[MediaTemplateResponse]
 *    (items carry `presignedUrls`, `presignedThumbnailUrls`, `enrichedSourceAssets`).
 *  - GET /api/media-templates/{id}    → MediaTemplateModel (raw; NO presigned URLs,
 *    NO enriched source assets — only `gcsUris`/`thumbnailUris`/`sourceAssets`).
 */

/** Nested `GenerationParameters` (backend model, camelCase on the wire). */
export type TemplateGenerationParameters = {
  prompt?: string | null;
  model?: string | null;
  aspectRatio?: string | null;
  style?: string | null;
  lighting?: string | null;
  colorAndTone?: string | null;
  composition?: string | null;
  negativePrompt?: string | null;
};

/** `SourceAssetLink` — present on both list and detail responses. */
export type TemplateSourceAsset = {
  assetId: number;
  role: string;
};

/** `SourceAssetLinkResponse` — only on the list response (`enrichedSourceAssets`). */
export type EnrichedSourceAsset = TemplateSourceAsset & {
  presignedUrl: string;
  gcsUri: string;
  presignedThumbnailUrl?: string | null;
  mimeType?: string | null;
};

/** `MediaTemplateModel` — raw template, served by the detail endpoint. */
export type MediaTemplate = {
  id: number;
  name: string;
  description: string;
  mimeType: string;
  industry?: string | null;
  brand?: string | null;
  tags?: string[];
  gcsUris?: string[];
  thumbnailUris?: string[];
  generationParameters: TemplateGenerationParameters;
  sourceAssets?: TemplateSourceAsset[] | null;
};

/** `MediaTemplateResponse` — list item; adds presigned/enriched display fields. */
export type MediaTemplateResponse = MediaTemplate & {
  presignedUrls?: string[];
  presignedThumbnailUrls?: string[];
  enrichedSourceAssets?: EnrichedSourceAsset[] | null;
};

/** `PaginationResponseDto[MediaTemplateResponse]`. */
export type TemplateListResponse = {
  data?: MediaTemplateResponse[];
  count?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

/** Angular `TemplateFilter` parity (fun-templates.component.ts applyFilters). */
export type TemplateFilter = {
  industry: string | null;
  /** MimeTypeEnum value: "image/png" | "video/mp4" | "audio/mpeg". */
  mediaType: string | null;
  tags: string | null;
  model: string | null;
  name: string | null;
};

export const EMPTY_TEMPLATE_FILTER: TemplateFilter = {
  industry: null,
  mediaType: null,
  tags: null,
  model: null,
  name: null,
};

/** MimeTypeEnum values (backend `common/base_dto.py`). */
export const TEMPLATE_MEDIA_TYPES = ["image/png", "video/mp4", "audio/mpeg"] as const;
