/** Copyright 2026 Google LLC — Apache-2.0 */
/*
 * Pure helpers for the workflow search hook. Backend contract: POST /api/workflows
 * body = WorkflowSearchDto {limit, offset, name}; response = WorkflowSearchResponseDto
 * {data, count, page, pageSize, totalPages}. Pagination is page/offset based (no
 * cursor), so `loadMore` keeps the current `name` and bumps `offset` — query is never
 * dropped. Kept React-free for direct unit testing.
 */
import type { WorkflowSearchDto, WorkflowSearchResponseDto } from "../types";

export interface SearchPageInput {
  name: string;
  page: number;
  pageSize: number;
}

/** Build the WorkflowSearchDto for a given page (offset = (page-1) * pageSize). */
export function buildSearchParams({ name, page, pageSize }: SearchPageInput): WorkflowSearchDto {
  const safePage = Math.max(1, Math.floor(page));
  return { limit: pageSize, offset: (safePage - 1) * pageSize, ...(name ? { name } : {}) };
}

export interface SearchPageMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  count: number;
}

/** Extract pagination metadata from a WorkflowSearchResponseDto with sane fallbacks. */
export function parseSearchMeta(response: Partial<WorkflowSearchResponseDto> | null | undefined, pageSize: number): SearchPageMeta {
  const data = response ?? {};
  const count = typeof data.count === "number" ? data.count : Array.isArray(data.data) ? data.data.length : 0;
  const totalPages = typeof data.totalPages === "number" && data.totalPages > 0 ? data.totalPages : Math.max(1, Math.ceil(count / Math.max(1, pageSize)));
  const page = typeof data.page === "number" && data.page > 0 ? data.page : 1;
  const resolvedPageSize = typeof data.pageSize === "number" && data.pageSize > 0 ? data.pageSize : pageSize;
  return { page, pageSize: resolvedPageSize, totalPages, count };
}
