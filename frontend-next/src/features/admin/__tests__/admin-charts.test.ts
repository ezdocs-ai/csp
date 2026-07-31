/**
 * Copyright 2026 Google LLC — Apache-2.0
 */
import { expect, test } from "bun:test";

import { linePoints, stackedHeights, overviewKpis, OVERVIEW_KPIS } from "../components/admin-charts";

test("stackedHeights computes total and columnPercent against the ceiling", () => {
  expect(stackedHeights({ workspace: "a", images: 1, videos: 2, audios: 3 }, 6)).toEqual({ total: 6, columnPercent: 100 });
  expect(stackedHeights({ workspace: "b", images: 1, videos: 0, audios: 0 }, 10)).toEqual({ total: 1, columnPercent: 10 });
});

test("stackedHeights guards against a zero/negative max", () => {
  expect(stackedHeights({ workspace: "a", images: 5, videos: 0, audios: 0 }, 0)).toEqual({ total: 5, columnPercent: 500 });
});

test("linePoints scales points across the viewBox and clamps a single point to the left margin", () => {
  expect(linePoints([{ month: "Jan", users: 10 }], 640, 240)).toBe("12,20");
  expect(linePoints([{ month: "Jan", users: 0 }, { month: "Feb", users: 10 }], 640, 240)).toBe("12,212 628,20");
});

test("linePoints guards against a zero/negative max", () => {
  expect(linePoints([{ month: "Jan", users: 0 }, { month: "Feb", users: 0 }], 640, 240)).toBe("12,212 628,212");
});

test("OVERVIEW_KPIS exposes the eight dashboard metrics in stable order", () => {
  expect(OVERVIEW_KPIS).toHaveLength(8);
  expect(OVERVIEW_KPIS.map((k) => k.key)).toEqual([
    "total_users", "total_workspaces", "images_generated", "videos_generated",
    "audios_generated", "total_media", "user_uploaded_media", "overall_total_media",
  ]);
  expect(OVERVIEW_KPIS.every((k) => k.label.length > 0 && k.tooltip.length > 0 && k.accent.length > 0)).toBe(true);
});

test("overviewKpis maps camelCase backend values into stable rows, defaulting missing keys to 0", () => {
  const rows = overviewKpis({ totalUsers: 10, imagesGenerated: 4 });
  expect(rows).toHaveLength(8);
  expect(rows[0]).toMatchObject({ key: "total_users", sourceKey: "totalUsers", label: "Total Users", value: 10 });
  expect(rows[2]).toMatchObject({ key: "images_generated", sourceKey: "imagesGenerated", label: "Images Gen.", value: 4 });
  expect(rows[1]).toMatchObject({ key: "total_workspaces", label: "Workspaces", value: 0 });
});

test("overviewKpis tolerates an undefined overview", () => {
  expect(overviewKpis(undefined).every((row) => row.value === 0)).toBe(true);
});
