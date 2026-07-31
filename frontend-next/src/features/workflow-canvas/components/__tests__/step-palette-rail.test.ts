/** Copyright 2026 Google LLC — Apache-2.0
 * v2 palette contract: the singleton `User input` item is gone; Inputs exposes the
 * independent `text-input`/`image-input` (multiple allowed), and Generate adds the
 * distinct `ingredients-image`. `onAdd`/drag payload carry `CanvasAddKind`, parsed
 * type-safely by `parseDragKind`. Bun's DOM-less runner covers the pure helpers. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";

import {
  PALETTE_GROUPS,
  STEP_DISPLAY,
  STEP_DRAG_TYPE,
  backendStepTypeForKind,
  parseDragKind,
  resolvePaletteItems,
  StepPaletteRail,
} from "../step-palette-rail";

test("PALETTE_GROUPS: Inputs holds both independent inputs and no user-input singleton", () => {
  const inputs = PALETTE_GROUPS.find((g) => g.id === "inputs");
  expect(inputs?.kinds).toEqual(["text-input", "image-input"]);
  const all = PALETTE_GROUPS.flatMap((g) => g.kinds);
  expect(all).not.toContain("user-input");
  expect(new Set(all).size).toBe(all.length);
});

test("Generate group lists Ingredients to image alongside the ordinary generate steps", () => {
  const generate = PALETTE_GROUPS.find((g) => g.id === "generate");
  expect(generate?.kinds).toEqual(["ingredients-image", "image", "text", "video", "audio"]);
});

test("resolvePaletteItems: both inputs allowed (never disabled), no user-input", () => {
  const items = resolvePaletteItems();
  const inputLabels = items
    .filter((i) => i.kind === "text-input" || i.kind === "image-input")
    .map((i) => i.label);
  expect(inputLabels).toEqual(["Text input", "Image input"]);
  expect(items.find((i) => i.kind === "user-input")).toBeUndefined();
});

test("parseDragKind accepts every palette kind and rejects user-input/garbage", () => {
  expect(parseDragKind("text-input")).toBe("text-input");
  expect(parseDragKind("image-input")).toBe("image-input");
  expect(parseDragKind("ingredients-image")).toBe("ingredients-image");
  expect(parseDragKind("image")).toBe("image");
  expect(parseDragKind("user-input")).toBeNull();
  expect(parseDragKind("bogus")).toBeNull();
  expect(parseDragKind(null)).toBeNull();
});

test("backendStepTypeForKind maps virtual/ingredients to their hidden/ordinary backend step", () => {
  expect(backendStepTypeForKind("text-input")).toBe("user-input");
  expect(backendStepTypeForKind("image-input")).toBe("user-input");
  expect(backendStepTypeForKind("ingredients-image")).toBe("image");
  expect(backendStepTypeForKind("text")).toBe("text");
});

test("STEP_DRAG_TYPE is a stable mime key", () => {
  expect(STEP_DRAG_TYPE).toBe("application/x-tri-workflow-step");
});

test("every palette kind has a human label and a valid drag payload kind", () => {
  const kinds = Object.keys(STEP_DISPLAY);
  for (const kind of kinds) {
    expect(parseDragKind(kind)).toBe(kind);
    expect(STEP_DISPLAY[kind as keyof typeof STEP_DISPLAY].label.length).toBeGreaterThan(0);
  }
});

function renderPalette(variant?: "rail" | "list"): string {
  return renderToStaticMarkup(
    createElement(StepPaletteRail, { onAdd: () => {}, ...(variant ? { variant } : {}) }),
  );
}

test("desktop rail renders one accessible icon button per palette item", () => {
  const html = renderPalette("rail");
  for (const item of resolvePaletteItems()) {
    expect(html).toContain(`aria-label="Add ${item.label}"`);
  }
  expect(html).not.toContain(">+<");
  expect(html).not.toContain(">Text input<");
});

test("desktop rail keeps draggable rows and visual group separators", () => {
  const html = renderPalette("rail");
  expect((html.match(/draggable="true"/g) ?? []).length).toBe(resolvePaletteItems().length);
  expect((html.match(/<hr/g) ?? []).length).toBe(PALETTE_GROUPS.length - 1);
  expect(html).toContain("sr-only");
});

test("default mobile list retains visible labels and add controls", () => {
  const html = renderPalette();
  expect(html).toContain(">Text input<");
  expect(html).toContain(">+<");
});
