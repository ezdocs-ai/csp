/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import {
  compositeKey,
  getShortPrompt,
  groupMediaByDate,
  isTallMedia,
  isWideMedia,
  parseAspectRatio,
  selectionRange,
  type GalleryItem,
} from "../gallery-utils";

// Deterministic local "now": 2026-03-15 12:00 local (a Sunday). Using noon
// avoids date-boundary flakiness across timezones.
const NOW = new Date(2026, 2, 15, 12, 0, 0);
const localISO = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

const item = (over: Partial<GalleryItem> = {}): GalleryItem =>
  ({
    id: 1,
    workspaceId: 1,
    createdAt: localISO(2026, 2, 15),
    itemType: "media_item",
    gcsUris: [],
    thumbnailUris: [],
    tags: [],
    presignedUrls: [],
    presignedThumbnailUrls: [],
    ...over,
  }) as GalleryItem;

test("groupMediaByDate: Today bucket", () => {
  const groups = groupMediaByDate([item({ id: 1, createdAt: localISO(2026, 2, 15) })], NOW);
  expect(groups).toHaveLength(1);
  expect(groups[0].title).toBe("Today");
  expect(groups[0].items).toHaveLength(1);
});

test("groupMediaByDate: Yesterday bucket", () => {
  const groups = groupMediaByDate([item({ id: 1, createdAt: localISO(2026, 2, 14) })], NOW);
  expect(groups[0].title).toBe("Yesterday");
});

test("groupMediaByDate: weekly range within 60 days", () => {
  // 2026-02-20 falls in the week of Sun 2026-02-15 → Sat 2026-02-21.
  const groups = groupMediaByDate([item({ id: 1, createdAt: localISO(2026, 1, 20) })], NOW);
  expect(groups[0].title).toBe("Feb 15 - 21");
});

test("groupMediaByDate: weekly range crossing month boundary shows both months", () => {
  // 2026-03-03 is in week of Sun 2026-03-01 → Sat 2026-03-07 (same month).
  // 2026-02-28 is in week of Sun 2026-02-22 → Sat 2026-02-28 (same month).
  // Use 2026-04-30 → week Sun 2026-04-26 → Sat 2026-05-02 (crosses month).
  const crossNow = new Date(2026, 4, 15, 12, 0, 0);
  const groups = groupMediaByDate([item({ id: 1, createdAt: localISO(2026, 3, 30) })], crossNow);
  expect(groups[0].title).toBe("Apr 26 - May 2");
});

test("groupMediaByDate: monthly for older than 60 days", () => {
  const groups = groupMediaByDate([item({ id: 1, createdAt: localISO(2025, 11, 10) })], NOW);
  expect(groups[0].title).toBe("December 2025");
});

test("groupMediaByDate: preserves first-seen group order", () => {
  const groups = groupMediaByDate(
    [
      item({ id: 1, createdAt: localISO(2025, 11, 10) }), // older
      item({ id: 2, createdAt: localISO(2026, 2, 15) }), // today
      item({ id: 3, createdAt: localISO(2025, 11, 10) }), // older (dup group)
    ],
    NOW,
  );
  expect(groups.map((g) => g.title)).toEqual(["December 2025", "Today"]);
  expect(groups[0].items).toHaveLength(2);
  expect(groups[1].items).toHaveLength(1);
});

test("groupMediaByDate: drops items without createdAt", () => {
  const groups = groupMediaByDate([item({ id: 1, createdAt: "" })], NOW);
  expect(groups).toHaveLength(0);
});

test("parseAspectRatio: valid ratios", () => {
  expect(parseAspectRatio("16:9")).toBeCloseTo(16 / 9);
  expect(parseAspectRatio("1:1")).toBe(1);
  expect(parseAspectRatio("2:1")).toBe(2);
  expect(parseAspectRatio("1:2")).toBe(0.5);
});

test("parseAspectRatio: invalid returns null", () => {
  expect(parseAspectRatio(undefined)).toBeNull();
  expect(parseAspectRatio(null)).toBeNull();
  expect(parseAspectRatio("garbage")).toBeNull();
  expect(parseAspectRatio("16:0")).toBeNull();
  expect(parseAspectRatio("16")).toBeNull();
});

test("isWideMedia: ratio >= 2 or audio fallback", () => {
  expect(isWideMedia(parseAspectRatio("2:1"), false)).toBe(true);
  expect(isWideMedia(parseAspectRatio("3:1"), false)).toBe(true);
  expect(isWideMedia(parseAspectRatio("16:9"), false)).toBe(false);
  expect(isWideMedia(null, true)).toBe(true); // audio without ratio
  expect(isWideMedia(null, false)).toBe(false);
});

test("isTallMedia: ratio <= 0.5", () => {
  expect(isTallMedia(parseAspectRatio("1:2"))).toBe(true);
  expect(isTallMedia(parseAspectRatio("1:3"))).toBe(true);
  expect(isTallMedia(parseAspectRatio("1:1"))).toBe(false);
  expect(isTallMedia(null)).toBe(false);
});

test("selectionRange: null anchor returns null", () => {
  expect(selectionRange(null, 5)).toBeNull();
});

test("selectionRange: inclusive min/max regardless of direction", () => {
  expect(selectionRange(2, 5)).toEqual([2, 5]);
  expect(selectionRange(5, 2)).toEqual([2, 5]);
  expect(selectionRange(3, 3)).toEqual([3, 3]);
});

test("selectionRange: anchor 0 works (not falsy-gated)", () => {
  expect(selectionRange(0, 4)).toEqual([0, 4]);
});

test("compositeKey: joins itemType and id", () => {
  expect(compositeKey({ itemType: "media_item", id: 42 })).toBe("media_item:42");
  expect(compositeKey({ itemType: "source_asset", id: 7 })).toBe("source_asset:7");
});

test("getShortPrompt: returns fallback for empty", () => {
  expect(getShortPrompt(undefined)).toBe("Generated media");
  expect(getShortPrompt(null)).toBe("Generated media");
  expect(getShortPrompt("")).toBe("Generated media");
});

test("getShortPrompt: parses JSON with prompt_name", () => {
  const prompt = JSON.stringify({ prompt_name: "a red cat on a chair" });
  expect(getShortPrompt(prompt)).toBe("a red cat on a chair");
});

test("getShortPrompt: falls back to raw when JSON has no prompt_name", () => {
  expect(getShortPrompt("plain text prompt")).toBe("plain text prompt");
  expect(getShortPrompt(JSON.stringify({ other: "x" }))).toBe(JSON.stringify({ other: "x" }));
});

test("getShortPrompt: truncates over word limit", () => {
  const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
  const result = getShortPrompt(long, 20);
  expect(result.endsWith("...")).toBe(true);
  expect(result.split(/\s+/).length).toBe(20); // ellipsis is glued to the 20th word
  expect(result.startsWith("word0 word1 ")).toBe(true);
  expect(result).toContain("word19...");
});
