/**
 * Copyright 2026 Google LLC — Apache-2.0
 */
import { expect, test } from "bun:test";

import { buildMediaQuery } from "../components/media-gallery-admin";

const base = { search: "", email: "", status: "", type: "", model: "", tags: [], start: "", end: "" };

test("buildMediaQuery always emits limit and offset and skips empty filters", () => {
  expect(buildMediaQuery({ ...base, offset: 0, limit: 10 })).toBe("?limit=10&offset=0");
});

test("buildMediaQuery serializes every active filter with snake_case backend keys", () => {
  const query = buildMediaQuery({
    search: "cat dog",
    email: "a@b.com",
    status: "completed",
    type: "media_item",
    model: "veo-3.1-generate-001",
    tags: ["red", "blue"],
    start: "2026-01-01",
    end: "2026-01-31",
    offset: 25,
    limit: 25,
  });
  expect(query).toBe(
    "?search=cat+dog&user_email=a%40b.com&status=completed&item_type=media_item&model=veo-3.1-generate-001&tags=red%2Cblue&start_date=2026-01-01&end_date=2026-01-31&limit=25&offset=25",
  );
});

test("buildMediaQuery omits tags when the array is empty", () => {
  expect(buildMediaQuery({ ...base, tags: [], offset: 0, limit: 10 })).not.toContain("tags");
});
