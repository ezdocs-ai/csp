/** Copyright 2026 Google LLC — Apache-2.0
 * Pure unit tests for the handle-derivation helpers in `base-workflow-node`.
 * Bun's built-in runner (no DOM / RTL is installed). No graph state is
 * exercised here — only the deterministic mapping from node data to the typed
 * connection ports the graph adapter emits. */
import { describe, expect, test } from "bun:test";

import {
  HANDLE_DOT_STYLE,
  HANDLE_HIT_BOX_STYLE,
  HANDLE_HIT_SIZE,
  HANDLE_VISIBLE_SIZE,
  handleSignature,
  nodeAccent,
  nodeTypeLabel,
  orderBadge,
  sourceHandleSpecs,
  targetHandleSpecs,
  workflowNodeTypes,
  type WorkflowHandleSpec,
} from "./base-workflow-node";
import type { WorkflowCanvasNodeData } from "../graph-types";
import type { StepType } from "../../workflow-editor/types";

function nodeData(stepType: StepType, over: Partial<WorkflowCanvasNodeData> = {}): WorkflowCanvasNodeData {
  return {
    stepId: "s1",
    stepType,
    label: "Step",
    config: {},
    validation: [],
    order: 1,
    ...over,
  };
}

describe("base-workflow-node handle derivation", () => {
  test("generated steps expose one source per declared output", () => {
    expect(sourceHandleSpecs(nodeData("image"))).toEqual<WorkflowHandleSpec[]>([
      { id: "generated_image", label: "Image", refType: "image", side: "source" },
    ]);
    expect(sourceHandleSpecs(nodeData("text"))).toEqual<WorkflowHandleSpec[]>([
      { id: "generated_text", label: "Text", refType: "text", side: "source" },
    ]);
    expect(sourceHandleSpecs(nodeData("audio"))).toEqual<WorkflowHandleSpec[]>([
      { id: "generated_audio", label: "Audio", refType: "audio", side: "source" },
    ]);
  });

  test("vto exposes a required scalar image ref plus optional scalar refs", () => {
    const vto = targetHandleSpecs(nodeData("vto"));
    expect(vto.map((h) => h.id)).toEqual(["model_image", "top_image", "bottom_image", "dress_image", "shoes_image"]);
    expect(vto[0]).toMatchObject({ id: "model_image", multi: false, required: true, refType: "image" });
    expect(vto[1]).toMatchObject({ id: "top_image", multi: false, refType: "image" });
  });

  test("acceptsRef prompt fields are scalar (text-type) targets", () => {
    // audio has only an acceptsRef prompt; edit exposes its prompt (input_images ref-list is gated below).
    expect(targetHandleSpecs(nodeData("audio")).map((h) => h.id)).toEqual(["prompt"]);
    const edit = targetHandleSpecs(nodeData("edit"));
    expect(edit.map((h) => h.id)).toEqual(["prompt"]);
    expect(edit[0]).toMatchObject({ id: "prompt", multi: false, required: true, refType: "text" });
  });

  test("generic ref-lists are targets; user-input has none", () => {
    // text: acceptsRef prompt + two generic (non-gated) ref-lists, in field order.
    const text = targetHandleSpecs(nodeData("text"));
    expect(text.map((h) => h.id)).toEqual(["prompt", "input_images", "input_videos"]);
    expect(text.find((h) => h.id === "input_videos")).toMatchObject({ multi: true, refType: "video" });
    // user-input outputs are sources only — it never has a target handle.
    expect(targetHandleSpecs(nodeData("user-input"))).toEqual([]);
  });

  test("the image-ingredients ref-list is capability-gated while the prompt target is always present", () => {
    // Capable model: prompt (acceptsRef) + the gated Ingredients ref-list.
    const supported = targetHandleSpecs(nodeData("image", { config: { model: "gemini-3.1-flash-image" } }));
    expect(supported.map((h) => h.id)).toEqual(["prompt", "input_images"]);
    expect(supported.find((h) => h.id === "input_images")).toMatchObject({
      label: "Ingredients / Reference images",
      refType: "image",
      multi: true,
    });
    // Incapable / missing model: the gated ref-list hides, but the prompt target remains.
    expect(targetHandleSpecs(nodeData("image", { config: { model: "veo-3.0-generate-001" } })).map((h) => h.id)).toEqual(["prompt"]);
    expect(targetHandleSpecs(nodeData("image")).map((h) => h.id)).toEqual(["prompt"]);
  });

  test("generic (non image-ingredients) ref-lists are never capability-gated", () => {
    // text's input_images/input_videos carry no refListCapability -> always visible under any model.
    expect(targetHandleSpecs(nodeData("text", { config: { model: "veo-3.0-generate-001" } })).map((h) => h.id)).toEqual([
      "prompt",
      "input_images",
      "input_videos",
    ]);
  });

  test("user-input source handles are dynamic + identifier-safe param names", () => {
    const specs = sourceHandleSpecs(
      nodeData("user-input", {
        inputParams: [
          { name: "My Prompt", type: "text" },
          { name: "Reference Photo", type: "image" },
        ],
      }),
    );
    expect(specs).toEqual<WorkflowHandleSpec[]>([
      { id: "my_prompt", label: "my_prompt", refType: "text", side: "source" },
      { id: "reference_photo", label: "reference_photo", refType: "image", side: "source" },
    ]);
  });

  test("workflowNodeTypes registers one component for all seven step kinds", () => {
    expect(Object.keys(workflowNodeTypes).sort()).toEqual(
      ["audio", "edit", "image", "text", "user-input", "video", "vto"].sort(),
    );
  });
});

describe("handleSignature (dynamic handle geometry change detection)", () => {
  const target = (id: string, refType: WorkflowHandleSpec["refType"], multi = false): WorkflowHandleSpec => ({
    id,
    label: id,
    refType,
    side: "target",
    ...(multi ? { multi: true } : {}),
  });
  const source = (id: string, refType: WorkflowHandleSpec["refType"]): WorkflowHandleSpec => ({
    id,
    label: id,
    refType,
    side: "source",
  });

  test("is identical for the same surface and order-independent", () => {
    const targets = [target("input_images", "image", true), target("model_image", "image")];
    const sources = [source("generated_image", "image")];
    expect(handleSignature(targets, sources)).toBe(
      handleSignature([...targets].reverse(), [...sources].reverse()),
    );
  });

  test("changes when a source handle id changes", () => {
    const before = handleSignature([target("input_images", "image", true)], [source("generated_image", "image")]);
    const after = handleSignature([target("input_images", "image", true)], [source("edited_image", "image")]);
    expect(before).not.toBe(after);
  });

  test("distinguishes a multi ref-list from a scalar ref with the same id/type", () => {
    const multi = handleSignature([target("input_images", "image", true)], []);
    const scalar = handleSignature([target("input_images", "image")], []);
    expect(multi).not.toBe(scalar);
  });

  test("changes when a handle refType changes", () => {
    const image = handleSignature([], [source("generated_image", "image")]);
    const text = handleSignature([], [source("generated_image", "text")]);
    expect(image).not.toBe(text);
  });

  test("changes when a target handle is added or removed", () => {
    const one = handleSignature([target("input_images", "image", true)], []);
    const two = handleSignature([target("input_images", "image", true), target("model_image", "image")], []);
    expect(one).not.toBe(two);
  });

  test("is stable for an empty surface", () => {
    expect(handleSignature([], [])).toBe("__");
  });
});

describe("v2 canvas-kind labels, accents, order badge", () => {
  test("nodeTypeLabel resolves virtual inputs and Ingredients to image; backend stepType unchanged", () => {
    expect(nodeTypeLabel(nodeData("user-input", { canvasKind: "text-input" }))).toBe("Text input");
    expect(nodeTypeLabel(nodeData("user-input", { canvasKind: "image-input" }))).toBe("Image input");
    expect(nodeTypeLabel(nodeData("image", { canvasKind: "ingredients-image" }))).toBe("Ingredients to image");
    // ordinary nodes keep their backend product label.
    expect(nodeTypeLabel(nodeData("image"))).toBe("Generate image");
    expect(nodeTypeLabel(nodeData("text"))).toBe("Generate text");
  });

  test("nodeAccent gives each canvas kind a distinct semantic accent", () => {
    const textInput = nodeAccent(nodeData("user-input", { canvasKind: "text-input" }));
    const imageInput = nodeAccent(nodeData("user-input", { canvasKind: "image-input" }));
    const ingredients = nodeAccent(nodeData("image", { canvasKind: "ingredients-image" }));
    expect(new Set([textInput, imageInput, ingredients]).size).toBe(3);
    expect(textInput).toBe("var(--tri-data-viz-7)");
    expect(imageInput).toBe("var(--tri-data-viz-6)");
    expect(ingredients).toBe("var(--tri-data-viz-5)");
  });

  test("orderBadge hides on virtual inputs (order null) and shows on executable nodes", () => {
    expect(orderBadge(null)).toBeNull();
    expect(orderBadge(1)).toBe("#1");
  });
});

describe("v2 virtual input nodes: one source handle, no targets", () => {
  const textInput = nodeData("user-input", { canvasKind: "text-input", inputParams: [{ name: "Prompt", type: "text" }] });
  const imageInput = nodeData("user-input", { canvasKind: "image-input", inputParams: [{ name: "Photo", type: "image" }] });

  test("a virtual input exposes exactly one source handle derived from the projected param output", () => {
    expect(sourceHandleSpecs(textInput)).toEqual<WorkflowHandleSpec[]>([
      { id: "prompt", label: "prompt", refType: "text", side: "source" },
    ]);
    expect(sourceHandleSpecs(imageInput)).toEqual<WorkflowHandleSpec[]>([
      { id: "photo", label: "photo", refType: "image", side: "source" },
    ]);
  });

  test("a virtual input never has target handles", () => {
    expect(targetHandleSpecs(textInput)).toEqual([]);
    expect(targetHandleSpecs(imageInput)).toEqual([]);
  });

  test("the projected output is digit-prefixed so the handle id matches compiled edges", () => {
    const digit = nodeData("user-input", { canvasKind: "text-input", inputParams: [{ name: "1st Photo", type: "image" }] });
    expect(sourceHandleSpecs(digit)[0]?.id).toBe("input_1st_photo");
  });
});

describe("handle hit-target invariants (compact dot, fat invisible grab area)", () => {
  test("visible dot stays compact while the hit box meets the 28–32px a11y floor", () => {
    expect(HANDLE_VISIBLE_SIZE).toBe(11);
    expect(HANDLE_HIT_SIZE).toBeGreaterThanOrEqual(28);
    expect(HANDLE_HIT_SIZE).toBeLessThanOrEqual(32);
    // The grab area is strictly larger than the dot — otherwise there is nothing to enlarge.
    expect(HANDLE_HIT_SIZE).toBeGreaterThan(HANDLE_VISIBLE_SIZE);
  });

  test("hit box is a transparent, borderless square sized to the hit area", () => {
    expect(HANDLE_HIT_BOX_STYLE.width).toBe(HANDLE_HIT_SIZE);
    expect(HANDLE_HIT_BOX_STYLE.height).toBe(HANDLE_HIT_SIZE);
    expect(HANDLE_HIT_BOX_STYLE.background).toBe("transparent");
    expect(HANDLE_HIT_BOX_STYLE.border).toBe("none");
    // Inline labeled-handle technique: relative + no transform so multiple labeled
    // handles stack in normal flow (RF default absolute transform must be defeated).
    expect(HANDLE_HIT_BOX_STYLE.position).toBe("relative");
    expect(HANDLE_HIT_BOX_STYLE.transform).toBe("none");
  });

  test("hit box negative margins collapse its flex footprint to the visible dot size (no node bloat)", () => {
    const overflow = (HANDLE_HIT_SIZE - HANDLE_VISIBLE_SIZE) / 2;
    expect(HANDLE_HIT_BOX_STYLE.marginTop).toBe(-overflow);
    expect(HANDLE_HIT_BOX_STYLE.marginBottom).toBe(-overflow);
    expect(HANDLE_HIT_BOX_STYLE.marginLeft).toBe(-overflow);
    expect(HANDLE_HIT_BOX_STYLE.marginRight).toBe(-overflow);
    // Flow footprint (width + horizontal margins) == visible dot width.
    const flowWidth =
      Number(HANDLE_HIT_BOX_STYLE.width) +
      Number(HANDLE_HIT_BOX_STYLE.marginLeft) +
      Number(HANDLE_HIT_BOX_STYLE.marginRight);
    expect(flowWidth).toBe(HANDLE_VISIBLE_SIZE);
  });

  test("hit box never overrides pointer-events — RF's connectionindicator owns the grab target", () => {
    expect(HANDLE_HIT_BOX_STYLE).not.toHaveProperty("pointerEvents");
  });

  test("visible dot is the compact 11px token-painted element centered in the hit box", () => {
    expect(HANDLE_DOT_STYLE.width).toBe(HANDLE_VISIBLE_SIZE);
    expect(HANDLE_DOT_STYLE.height).toBe(HANDLE_VISIBLE_SIZE);
    expect(HANDLE_DOT_STYLE.background).toBe("var(--tri-border-strong)");
    expect(HANDLE_DOT_STYLE.border).toBe("2px solid var(--tri-bg-surface)");
    expect(HANDLE_DOT_STYLE.borderRadius).toBe("var(--tri-radius-full)");
    expect(HANDLE_DOT_STYLE.top).toBe("50%");
    expect(HANDLE_DOT_STYLE.left).toBe("50%");
    expect(HANDLE_DOT_STYLE.transform).toBe("translate(-50%, -50%)");
    // Decorative only: pointer events must resolve to the handle element itself.
    expect(HANDLE_DOT_STYLE.pointerEvents).toBe("none");
  });
});
