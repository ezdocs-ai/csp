/** Copyright 2026 Google LLC — Apache-2.0 */
import { describe, expect, test } from "bun:test";

import { MarkerType } from "@xyflow/react";

import { DEFAULT_EDGE_OPTIONS } from "../components/canvas-pane";

/** Edge-visibility contract (canvas-pane): derived edges must carry a clear
 * directional marker, use a non-animated Bézier curve, have a comfortable
 * interaction hit-area, and use semantic tokens only (no raw colors). */
describe("DEFAULT_EDGE_OPTIONS (edge visibility)", () => {
  test("uses a non-animated Bézier curve without pointy right-angle bends", () => {
    // React Flow v12's built-in `default` edge is the Bézier implementation.
    expect(DEFAULT_EDGE_OPTIONS.type).toBe("default");
    expect(DEFAULT_EDGE_OPTIONS.animated).toBe(false);
  });

  test("carries a filled directional arrowhead marker", () => {
    const marker = DEFAULT_EDGE_OPTIONS.markerEnd;
    expect(marker).toBeDefined();
    expect(typeof marker).toBe("object");
    if (typeof marker === "object" && marker !== null) {
      expect(marker.type).toBe(MarkerType.ArrowClosed);
      // marker color is a semantic token, never a raw hex
      expect(marker.color).toMatch(/^var\(--tri-/);
    }
  });

  test("provides a sufficient interaction width for mouse/touch/keyboard", () => {
    expect(DEFAULT_EDGE_OPTIONS.interactionWidth).toBeGreaterThanOrEqual(24);
  });
});
