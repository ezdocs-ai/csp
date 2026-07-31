/** Copyright 2026 Google LLC — Apache-2.0 */
import type { MediaTemplate, MediaTemplateResponse, TemplateFilter } from "./types";

/**
 * Client-side filter mirroring Angular `FunTemplatesComponent.applyFilters`
 * (`frontend/src/app/fun-templates/fun-templates.component.ts`). The backend
 * `TemplateSearchDto` only supports industry/brand/mime_type/tag server-side, so
 * name + model matching happen here exactly as in Angular.
 */
export function filterTemplates<T extends MediaTemplate>(
  templates: readonly T[],
  filter: TemplateFilter,
): T[] {
  let result = [...templates];
  if (filter.industry) {
    result = result.filter((t) => t.industry === filter.industry);
  }
  if (filter.mediaType) {
    result = result.filter((t) => t.mimeType === filter.mediaType);
  }
  if (filter.name) {
    const needle = filter.name.toLowerCase();
    result = result.filter((t) => t.name.toLowerCase().includes(needle));
  }
  if (filter.model) {
    const needle = filter.model.toLowerCase();
    result = result.filter((t) =>
      t.generationParameters?.model?.toLowerCase().includes(needle),
    );
  }
  if (filter.tags) {
    const needle = filter.tags.toLowerCase();
    result = result.filter((t) =>
      (t.tags ?? []).some((tag) => tag.toLowerCase().includes(needle)),
    );
  }
  return result;
}

/** Unique, sorted industry values present in the given templates (Angular parity). */
export function uniqueIndustries(templates: readonly MediaTemplate[]): string[] {
  return [...new Set(templates.map((t) => t.industry).filter((v): v is string => Boolean(v)))].sort();
}

/** First displayable preview URL for a list item (thumbnail preferred). */
export function previewUrlFor(template: MediaTemplateResponse): string | undefined {
  return template.presignedThumbnailUrls?.[0] ?? template.presignedUrls?.[0];
}
