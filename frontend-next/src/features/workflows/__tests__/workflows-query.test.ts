/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { buildSearchParams, parseSearchMeta } from "../hooks/workflows-query";

test("buildSearchParams computes offset from page and includes name only when non-empty", () => {
  expect(buildSearchParams({ name: "", page: 1, pageSize: 12 })).toEqual({ limit: 12, offset: 0 });
  expect(buildSearchParams({ name: "cat", page: 1, pageSize: 12 })).toEqual({ limit: 12, offset: 0, name: "cat" });
  expect(buildSearchParams({ name: "cat", page: 3, pageSize: 12 })).toEqual({ limit: 12, offset: 24, name: "cat" });
});

test("buildSearchParams clamps invalid page to 1", () => {
  expect(buildSearchParams({ name: "", page: 0, pageSize: 12 }).offset).toBe(0);
  expect(buildSearchParams({ name: "", page: -2, pageSize: 12 }).offset).toBe(0);
});

test("parseSearchMeta reads response metadata verbatim", () => {
  expect(parseSearchMeta({ data: [], count: 37, page: 2, pageSize: 12, totalPages: 4 }, 12)).toEqual({ page: 2, pageSize: 12, totalPages: 4, count: 37 });
});

test("parseSearchMeta derives totalPages from count when missing", () => {
  const meta = parseSearchMeta({ data: new Array(5) }, 12);
  expect(meta.totalPages).toBe(1); // ceil(5/12)
  expect(meta.page).toBe(1);
});

test("parseSearchMeta falls back to data length for count when count missing", () => {
  const meta = parseSearchMeta({ data: new Array(3) }, 1);
  expect(meta.count).toBe(3);
  expect(meta.totalPages).toBe(3); // ceil(3/1)
});

test("parseSearchMeta tolerates null/empty response", () => {
  expect(parseSearchMeta(null, 12)).toEqual({ page: 1, pageSize: 12, totalPages: 1, count: 0 });
  expect(parseSearchMeta(undefined, 12).count).toBe(0);
});
