/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { defaultDashboardDateRange, resolveDashboardDateRange } from "../components/dashboard-date-range";

test("defaults the admin dashboard to the current local month", () => {
  expect(defaultDashboardDateRange(new Date(2026, 6, 15, 12))).toEqual({
    start: "2026-07-01",
    end: "2026-07-31",
    today: "2026-07-15",
  });
});

test("handles leap years and year boundaries", () => {
  expect(defaultDashboardDateRange(new Date(2024, 1, 10))).toEqual({
    start: "2024-02-01",
    end: "2024-02-29",
    today: "2024-02-10",
  });
  expect(defaultDashboardDateRange(new Date(2026, 11, 31))).toEqual({
    start: "2026-12-01",
    end: "2026-12-31",
    today: "2026-12-31",
  });
});

test("preserves a complete selected range", () => {
  expect(resolveDashboardDateRange(
    { start_date: "2026-01-03", end_date: "2026-01-20" },
    new Date(2026, 6, 15),
  )).toEqual({ start: "2026-01-03", end: "2026-01-20", today: "2026-07-15" });
});

test("distinguishes all-time clearing and normalizes incomplete ranges", () => {
  const now = new Date(2026, 6, 15);
  expect(resolveDashboardDateRange({ range: "all" }, now)).toEqual({
    start: "",
    end: "",
    today: "2026-07-15",
  });
  expect(resolveDashboardDateRange({ start_date: "2026-01-03" }, now)).toEqual({
    start: "2026-07-01",
    end: "2026-07-31",
    today: "2026-07-15",
  });
});
