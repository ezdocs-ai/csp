/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { guidelineBadge } from "../guideline-status";

test("guidelineBadge shows processing while loading regardless of status", () => {
  expect(guidelineBadge("completed", true)).toEqual({ label: "○ Processing", tone: "info" });
});

test("guidelineBadge maps terminal statuses to Angular dialog labels", () => {
  expect(guidelineBadge("completed")).toEqual({ label: "✓ Ready", tone: "success" });
  expect(guidelineBadge("failed")).toEqual({ label: "! Failed", tone: "danger" });
  expect(guidelineBadge("stopped")).toEqual({ label: "! Stopped", tone: "warning" });
});

test("guidelineBadge falls back to processing for unknown or idle statuses", () => {
  expect(guidelineBadge("processing")).toEqual({ label: "○ Processing", tone: "info" });
  expect(guidelineBadge(undefined)).toEqual({ label: "○ Processing", tone: "info" });
  expect(guidelineBadge("idle")).toEqual({ label: "○ Processing", tone: "info" });
});
