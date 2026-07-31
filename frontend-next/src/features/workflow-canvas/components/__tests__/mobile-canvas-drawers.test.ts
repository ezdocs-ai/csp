/** Copyright 2026 Google LLC — Apache-2.0 */
import { describe, expect, test } from "bun:test";

import { escapeTarget, trapFocusIndex, FOCUSABLE_SELECTOR, DRAWER_Z_INDEX, DRAWER_LAYER_CLASS, isSafeDrawerZ, BACKGROUND_INERT_SKIP_TAGS, shouldHideBackgroundChild } from "../mobile-canvas-drawers";

test("escapeTarget: nothing open closes nothing", () => {
  expect(escapeTarget(false, false)).toBeNull();
});

test("escapeTarget: inspector wins when both are open", () => {
  expect(escapeTarget(true, true)).toBe("right");
});

test("escapeTarget: only palette open targets the left drawer", () => {
  expect(escapeTarget(true, false)).toBe("left");
});

test("escapeTarget: only inspector open targets the right drawer", () => {
  expect(escapeTarget(false, true)).toBe("right");
});

describe("trapFocusIndex", () => {
  test("returns -1 for an empty trap so callers can no-op", () => {
    expect(trapFocusIndex(0, 0, false)).toBe(-1);
    expect(trapFocusIndex(2, 0, true)).toBe(-1);
  });

  test("Tab advances and wraps from last back to first", () => {
    expect(trapFocusIndex(0, 3, false)).toBe(1);
    expect(trapFocusIndex(1, 3, false)).toBe(2);
    expect(trapFocusIndex(2, 3, false)).toBe(0);
  });

  test("Shift+Tab retreats and wraps from first back to last", () => {
    expect(trapFocusIndex(2, 3, true)).toBe(1);
    expect(trapFocusIndex(0, 3, true)).toBe(2);
  });

  test("focus outside the list enters at 0 (Tab) or last (Shift+Tab)", () => {
    expect(trapFocusIndex(-1, 3, false)).toBe(0);
    expect(trapFocusIndex(-1, 3, true)).toBe(2);
    expect(trapFocusIndex(99, 3, false)).toBe(0);
  });

  test("a single-element trap always returns to itself", () => {
    expect(trapFocusIndex(0, 1, false)).toBe(0);
    expect(trapFocusIndex(0, 1, true)).toBe(0);
  });
});

test("FOCUSABLE_SELECTOR excludes disabled controls and negative tabindices", () => {
  expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
  expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
});

describe("DRAWER_Z_INDEX / DRAWER_LAYER_CLASS (portal layering)", () => {
  test("z clears the studio Sidebar (1000) but sits under the global LoadingBar (9999)", () => {
    expect(isSafeDrawerZ(DRAWER_Z_INDEX)).toBe(true);
    expect(isSafeDrawerZ(1000)).toBe(false);
    expect(isSafeDrawerZ(9999)).toBe(false);
    expect(isSafeDrawerZ(60)).toBe(false);
  });

  test("the literal wrapper class matches the documented z and lg gating", () => {
    expect(DRAWER_LAYER_CLASS).toContain("z-[1100]");
    expect(DRAWER_LAYER_CLASS).toContain("lg:hidden");
    expect(DRAWER_LAYER_CLASS).not.toContain("z-[60]");
  });
});

describe("shouldHideBackgroundChild (background inert filter)", () => {
  test("hides visual/interactive roots regardless of case", () => {
    expect(shouldHideBackgroundChild({ tagName: "div" })).toBe(true);
    expect(shouldHideBackgroundChild({ tagName: "DIV" })).toBe(true);
    expect(shouldHideBackgroundChild({ tagName: "header" })).toBe(true);
    expect(shouldHideBackgroundChild({ tagName: "main" })).toBe(true);
  });

  test("skips non-visual resource tags so scripts/styles are never touched", () => {
    for (const tag of BACKGROUND_INERT_SKIP_TAGS) {
      expect(shouldHideBackgroundChild({ tagName: tag })).toBe(false);
      expect(shouldHideBackgroundChild({ tagName: tag.toLowerCase() })).toBe(false);
    }
  });
});
