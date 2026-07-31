/**
 * Copyright 2026 Google LLC — Apache-2.0
 */
import { expect, test } from "bun:test";

import { dateRangeBounds } from "../components/dashboard-filters";

test("dateRangeBounds returns undefined bounds when the range is empty", () => {
  expect(dateRangeBounds("", "")).toEqual({ fromMax: undefined, toMin: undefined });
});

test("dateRangeBounds cross-links start/end so 'To' cannot precede 'From'", () => {
  expect(dateRangeBounds("2026-01-01", "2026-01-31")).toEqual({ fromMax: "2026-01-31", toMin: "2026-01-01" });
  expect(dateRangeBounds("2026-01-01", "")).toEqual({ fromMax: undefined, toMin: "2026-01-01" });
  expect(dateRangeBounds("", "2026-01-31")).toEqual({ fromMax: "2026-01-31", toMin: undefined });
});
