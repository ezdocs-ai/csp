// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

// Pure mappers between the backend media-template contract and the admin form.
// Kept UI-free so the non-trivial mapping logic is unit-testable.
//
// Backend truth (verified against controller + DTOs, 2026-07-29):
//  - GET /api/media-templates -> PaginationResponseDto<MediaTemplateResponse>,
//    serialized camelCase (BaseDto alias_generator=to_camel, FastAPI
//    response_model_by_alias default): id, name, description, mimeType,
//    industry, brand, tags[], gcsUris[], thumbnailUris[],
//    generationParameters{prompt,model,aspectRatio,style,lighting,
//    colorAndTone,composition,negativePrompt}, presignedUrls[],
//    presignedThumbnailUrls[].
//  - POST /api/media-templates/from-media-item/{id} is the ONLY create path;
//    the request body is not consumed (fields are derived server-side). There
//    is no plain POST /api/media-templates.
//  - PUT /api/media-templates/{id} -> UpdateTemplateDto (camelCase aliases
//    accepted, extra="forbid"): name, description, industry, brand, tags,
//    gcsUris, thumbnailUris, sourceAssets, generationParameters. mime_type is
//    immutable and must NOT be sent.

export type GenerationParameters = {
  prompt?: string | null;
  model?: string | null;
  aspectRatio?: string | null;
  style?: string | null;
  lighting?: string | null;
  colorAndTone?: string | null;
  composition?: string | null;
  negativePrompt?: string | null;
};

export type Template = {
  id: number;
  name: string;
  description?: string | null;
  mimeType?: string | null;
  industry?: string | null;
  brand?: string | null;
  tags?: string[] | null;
  gcsUris?: string[] | null;
  thumbnailUris?: string[] | null;
  generationParameters?: GenerationParameters | null;
  presignedUrls?: string[];
  presignedThumbnailUrls?: string[];
};

export type FormState = {
  mediaItemId: string;
  name: string;
  description: string;
  mimeType: string;
  model: string;
  industry: string;
  brand: string;
  tags: string;
  options: string;
  thumbnailUrl: string;
  gcsUri: string;
};

export const EMPTY_FORM: FormState = {
  mediaItemId: "",
  name: "",
  description: "",
  mimeType: "",
  model: "",
  industry: "",
  brand: "",
  tags: "",
  options: "{}",
  thumbnailUrl: "",
  gcsUri: "",
};

export function parseTags(raw: string): string[] {
  return raw.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export function parseOptionsJson(raw: string): GenerationParameters {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Options must be valid JSON.");
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as GenerationParameters)
    : {};
}

function firstUri(uris?: string[] | null): string {
  return Array.isArray(uris) && uris.length > 0 ? uris[0] ?? "" : "";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

export function templateToForm(template: Template): FormState {
  const params: GenerationParameters = template.generationParameters ?? {};
  // model lives in its own form field; keep the JSON blob free of it.
  const options: GenerationParameters = { ...params };
  delete options.model;
  return {
    mediaItemId: "",
    name: template.name ?? "",
    description: template.description ?? "",
    mimeType: template.mimeType ?? "",
    model: params.model ?? "",
    industry: template.industry ?? "",
    brand: template.brand ?? "",
    tags: (template.tags ?? []).join(", "),
    options: safeStringify(options),
    thumbnailUrl: firstUri(template.thumbnailUris),
    gcsUri: firstUri(template.gcsUris),
  };
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

function prune<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isEmpty(value)) out[key] = value;
  }
  return out as Partial<T>;
}

// Form -> backend UpdateTemplateDto (camelCase aliases). Empty values are
// omitted so the backend (exclude_unset) leaves them untouched; only contract
// fields are emitted because the DTO uses extra="forbid".
export function formToUpdateBody(form: FormState): Record<string, unknown> {
  const options = parseOptionsJson(form.options);
  return prune({
    name: form.name,
    description: form.description,
    industry: form.industry,
    brand: form.brand,
    tags: parseTags(form.tags),
    gcsUris: form.gcsUri ? [form.gcsUri] : [],
    thumbnailUris: form.thumbnailUrl ? [form.thumbnailUrl] : [],
    generationParameters: prune({ ...options, model: form.model }),
  });
}

// Form -> create payload. Backend ignores the body; only the path id matters,
// but we validate client-side to give a clear error before the round-trip.
export function formToCreateBody(form: FormState): { mediaItemId: number } {
  const mediaItemId = Number(form.mediaItemId);
  if (!Number.isInteger(mediaItemId) || mediaItemId <= 0) {
    throw new Error("A valid source Media Item ID is required to create a template.");
  }
  return { mediaItemId };
}
