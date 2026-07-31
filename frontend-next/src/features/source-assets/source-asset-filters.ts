// Copyright 2026 Google LLC — Apache-2.0
//
// Pure helpers for the admin source-assets browse/upload journey.
// Mirrors backend enums in `backend/src/source_assets/schema/source_asset_model.py`
// (AssetScopeEnum, AssetTypeEnum) and the admin-only filters declared in
// `backend/src/source_assets/dto/source_asset_search_dto.py`. Unit-tested.

import { pageOffset, toQuery, type QueryParams, type SortDirection } from "../admin/components/admin-controls";

/** Asset visibility — mirrors backend `AssetScopeEnum`. */
export const AssetScope = {
  PRIVATE: "private",
  SYSTEM: "system",
} as const;
export type AssetScope = (typeof AssetScope)[keyof typeof AssetScope];

/** Asset purpose — mirrors backend `AssetTypeEnum`. */
export const AssetType = {
  GENERIC_IMAGE: "generic_image",
  GENERIC_VIDEO: "generic_video",
  VTO_PRODUCT: "vto_product",
  VTO_PERSON_FEMALE: "vto_person_female",
  VTO_PERSON_MALE: "vto_person_male",
  VTO_TOP: "vto_top",
  VTO_BOTTOM: "vto_bottom",
  VTO_DRESS: "vto_dress",
  VTO_SHOE: "vto_shoe",
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const ASSET_SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: AssetScope.PRIVATE, label: "Private" },
  { value: AssetScope.SYSTEM, label: "System" },
];

export const ASSET_TYPE_OPTIONS: { value: string; label: string }[] = Object.values(AssetType).map((value) => ({
  value,
  label: value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
}));

/** Admin browse filters captured by the source-assets management UI. */
export interface SourceAssetFilters {
  search: string;
  scope: string;
  assetType: string;
}

export const EMPTY_SOURCE_ASSET_FILTERS: SourceAssetFilters = { search: "", scope: "", assetType: "" };

/** Sortable columns in the admin asset table. */
export type SourceAssetSortKey = "name" | "type" | "created";

/**
 * Build the BFF query string for `/api/source-assets`. Empty/blank filters are
 * dropped so the backend returns the unfiltered platform-wide set (admin browse).
 * Pagination uses offset math shared with the rest of admin.
 */
export function buildSourceAssetQuery(
  filters: SourceAssetFilters,
  pageIndex: number,
  pageSize: number,
): string {
  const params: QueryParams = {
    search: filters.search.trim() || null,
    scope: filters.scope || null,
    asset_type: filters.assetType || null,
    page: pageIndex + 1,
    pageSize,
    offset: pageOffset(pageIndex, pageSize),
  };
  return toQuery(params);
}

/**
 * Build the multipart `fields` map passed to `useSourceAssets().upload` from the
 * Create-Asset dialog. Backend `/api/source_assets/upload` Form fields are
 * `scope`, `assetType` (plus `workspaceId`, set by the hook). Only non-default
 * values are sent so regular uploads are untouched.
 */
export function buildUploadFields(scope: string, assetType: string): Record<string, string> {
  const fields: Record<string, string> = {};
  if (scope) fields.scope = scope;
  if (assetType) fields.assetType = assetType;
  return fields;
}

/** Cycle sort direction the same way the rest of admin does. */
export function nextSortDirection(current: SortDirection): SortDirection {
  return current === "asc" ? "desc" : current === "desc" ? null : "asc";
}
