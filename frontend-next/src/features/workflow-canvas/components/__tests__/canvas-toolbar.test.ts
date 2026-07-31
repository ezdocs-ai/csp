/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { formatWorkflowStatus, runDisabledReason } from "../canvas-toolbar";

test("formatWorkflowStatus: dirty overrides saved state", () => {
  expect(formatWorkflowStatus(true, true, true)).toEqual({ label: "Unsaved changes", tone: "warning" });
  expect(formatWorkflowStatus(false, true, false)).toEqual({ label: "Unsaved changes", tone: "warning" });
});

test("formatWorkflowStatus: saved + valid reads success", () => {
  expect(formatWorkflowStatus(true, false, true)).toEqual({ label: "Saved", tone: "success" });
});

test("formatWorkflowStatus: saved but invalid falls back to neutral", () => {
  expect(formatWorkflowStatus(true, false, false)).toEqual({ label: "Saved", tone: "neutral" });
});

test("formatWorkflowStatus: fresh draft is neutral", () => {
  expect(formatWorkflowStatus(false, false, true)).toEqual({ label: "Draft", tone: "neutral" });
});

test("runDisabledReason: save before run", () => {
  expect(runDisabledReason({ saved: false, valid: true })).toBe("Save the workflow first");
  expect(runDisabledReason({ saved: true, valid: false })).toBe("Resolve validation errors first");
  expect(runDisabledReason({ saved: true, valid: true })).toBe("");
});
