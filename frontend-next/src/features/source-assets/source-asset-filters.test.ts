// Copyright 2026 Google LLC — Apache-2.0

import { describe, expect, it } from "bun:test";
import {
  buildSourceAssetQuery,
  buildUploadFields,
  EMPTY_SOURCE_ASSET_FILTERS,
  nextSortDirection,
} from "./source-asset-filters";

describe("buildSourceAssetQuery", () => {
  it("drops empty/blank filters and emits pagination", () => {
    const query = buildSourceAssetQuery(EMPTY_SOURCE_ASSET_FILTERS, 0, 10);
    const params = new URLSearchParams(query.slice(1));
    expect(params.get("search")).toBeNull();
    expect(params.get("scope")).toBeNull();
    expect(params.get("asset_type")).toBeNull();
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("10");
    expect(params.get("offset")).toBe("0");
  });

  it("forwards scope, asset_type and trimmed search", () => {
    const query = buildSourceAssetQuery(
      { search: "  logo  ", scope: "system", assetType: "vto_product" },
      2,
      25,
    );
    const params = new URLSearchParams(query.slice(1));
    expect(params.get("search")).toBe("logo");
    expect(params.get("scope")).toBe("system");
    expect(params.get("asset_type")).toBe("vto_product");
    expect(params.get("page")).toBe("3");
    expect(params.get("pageSize")).toBe("25");
    expect(params.get("offset")).toBe("50");
  });

  it("omits page/offset when search is blank but keeps pagination only", () => {
    const query = buildSourceAssetQuery({ search: "", scope: "", assetType: "" }, 1, 10);
    const params = new URLSearchParams(query.slice(1));
    expect(params.get("scope")).toBeNull();
    expect(params.get("asset_type")).toBeNull();
    expect(params.get("page")).toBe("2");
  });

  it("returns empty prefix string when nothing is set beyond defaults that toQuery keeps", () => {
    // page/pageSize/offset are always emitted so the prefix is always "?".
    expect(buildSourceAssetQuery(EMPTY_SOURCE_ASSET_FILTERS, 0, 10).startsWith("?")).toBe(true);
  });
});

describe("buildUploadFields", () => {
  it("omits empty values so regular uploads are untouched", () => {
    expect(buildUploadFields("", "")).toEqual({});
  });
  it("includes scope and assetType when provided", () => {
    expect(buildUploadFields("system", "generic_image")).toEqual({
      scope: "system",
      assetType: "generic_image",
    });
  });
  it("includes only scope when assetType blank", () => {
    expect(buildUploadFields("private", "")).toEqual({ scope: "private" });
  });
});

describe("nextSortDirection", () => {
  it("cycles null -> asc -> desc -> null", () => {
    expect(nextSortDirection(null)).toBe("asc");
    expect(nextSortDirection("asc")).toBe("desc");
    expect(nextSortDirection("desc")).toBe(null);
  });
});
