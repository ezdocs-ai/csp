/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import type { WorkflowStep } from "../../workflow-editor/types";
import {
  connectionToConfigPatch,
  deterministicLayout,
  edgeId,
  isLiteralOrRefField,
  literalOrRefValueOf,
  outputSpecsFor,
  refsForField,
  removeEdgeToConfigPatch,
  stepsToEdges,
  stepsToNodes,
} from "../adapters/graph-adapter";
import { isModelGatedRefList } from "../../workflow-editor/hooks/step-configs";
import type { BackendInputRef } from "../../workflow-editor/hooks/step-configs";
import type { SavedLayout } from "../graph-types";
import { virtualInputId } from "../adapters/virtual-inputs";
import type { InputParam } from "../../workflow-editor/types";

const step = (
  id: string,
  type: WorkflowStep["type"],
  extra: Partial<WorkflowStep> = {},
): WorkflowStep => ({
  id,
  type,
  label: id,
  inputs: [{ mode: "fixed" }],
  ...extra,
});

const img = (id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep =>
  step(id, "image", {
    config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false, ...extra.config },
    ...extra,
  });

const ui = (id: string, params: { name: string; type: InputParam["type"] }[] = []): WorkflowStep =>
  step(id, "user-input", { inputParams: params });

const txt = (id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => {
  const { config: extraConfig, ...rest } = extra;
  return step(id, "text", { ...rest, config: { prompt: "p", model: "gemini-3-flash-preview", temperature: 0.7, ...extraConfig } });
};

// --- outputSpecsFor: static for generated, dynamic for user-input ---

test("outputSpecsFor returns STEP_OUTPUTS for generated steps", () => {
  expect(outputSpecsFor(step("i", "image")).map((o) => o.name)).toEqual(["generated_image"]);
  expect(outputSpecsFor(step("t", "text")).map((o) => o.name)).toEqual(["generated_text"]);
});

test("outputSpecsFor derives dynamic outputs from user-input params (normalized)", () => {
  const uiStep = step("ui", "user-input", { inputParams: [{ name: "Prompt", type: "text" }, { name: "User Image", type: "image" }] });
  expect(outputSpecsFor(uiStep)).toEqual([
    { name: "prompt", type: "text" },
    { name: "user_image", type: "image" },
  ]);
});

test("outputSpecsFor prefixes digit-leading param names so refs resolve consistently (normalizeParamOutputName)", () => {
  const uiStep = step("ui", "user-input", { inputParams: [{ name: "1st Photo", type: "image" }] });
  expect(outputSpecsFor(uiStep)).toEqual([{ name: "input_1st_photo", type: "image" }]);
});

// --- stepsToEdges: canonical config refs are the only source ---

test("stepsToEdges emits one edge per scalar ref", () => {
  const steps = [
    img("gen_1"),
    step("vto_1", "vto", { config: { model_image: "gen_1::generated_image" } }),
  ];
  const edges = stepsToEdges(steps);
  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({
    id: edgeId("gen_1", "generated_image", "vto_1", "model_image"),
    source: "gen_1",
    target: "vto_1",
    sourceHandle: "generated_image",
    targetHandle: "model_image",
    refType: "image",
    cardinality: "scalar",
  });
});

test("stepsToEdges emits one edge per ordered ref-list entry", () => {
  const steps = [
    img("a"),
    img("b"),
    img("c", { config: { prompt: "fuse", input_images: [{ step: "a", output: "generated_image" }, { step: "b", output: "generated_image" }] } }),
  ];
  const edges = stepsToEdges(steps);
  expect(edges).toHaveLength(2);
  expect(edges.every((e) => e.cardinality === "list")).toBe(true);
  expect(edges.map((e) => e.source)).toEqual(["a", "b"]);
});

test("stepsToEdges ignores legacy outputRef and inputs[].sourceStepId", () => {
  const steps = [
    step("a", "image", { outputRef: "gen_1::generated_image", config: { prompt: "p", model: "m", aspect_ratio: "1:1", brand_guidelines: false } }),
    step("b", "image", { inputs: [{ mode: "linked", sourceStepId: "a" }], config: { prompt: "p", model: "m", aspect_ratio: "1:1", brand_guidelines: false } }),
  ];
  expect(stepsToEdges(steps)).toEqual([]);
});

test("stepsToEdges caches refType from the source output even when the field refType is loose", () => {
  const steps = [
    step("ui", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] }),
    step("t", "text", { config: { prompt: "ui::prompt", model: "m", temperature: 0.7 } }),
  ];
  const edges = stepsToEdges(steps);
  expect(edges[0]?.refType).toBe("text");
});

// --- deterministicLayout: deterministic, level-based, isolated lane ---

test("deterministicLayout places dependencies to the left of dependents", () => {
  const steps = [
    img("a"),
    img("b", { config: { prompt: "fuse", input_images: [{ step: "a", output: "generated_image" }] } }),
  ];
  const pos = deterministicLayout(steps);
  expect(pos.get("a")!.x).toBeLessThan(pos.get("b")!.x);
  expect(pos.get("a")!.x).toBeGreaterThanOrEqual(0);
});

test("deterministicLayout puts disconnected nodes in a separate left lane", () => {
  const steps = [img("iso1"), img("iso2")];
  const pos = deterministicLayout(steps);
  // Both isolated => column -1.
  expect(pos.get("iso1")!.x).toBe(pos.get("iso2")!.x);
  expect(pos.get("iso1")!.x).toBeLessThan(0);
  expect(pos.get("iso1")!.y).not.toBe(pos.get("iso2")!.y);
});

test("deterministicLayout does not loop on cycles (guard)", () => {
  const steps = [
    step("a", "edit", { config: { input_images: "b::generated_image", prompt: "p", model: "m", aspect_ratio: "1:1", brand_guidelines: false } }),
    img("b", { config: { prompt: "fuse", input_images: [{ step: "a", output: "edited_image" }] } }),
  ];
  expect(() => deterministicLayout(steps)).not.toThrow();
});

// --- stepsToNodes: saved positions win, fallback otherwise ---

test("stepsToNodes uses saved positions when present, else deterministic fallback", () => {
  const steps = [img("a"), img("b")];
  const saved: SavedLayout = {
    version: 1,
    hash: "irrelevant-here-stepsToNodes-does-not-check",
    nodes: [{ stepId: "a", position: { x: 100, y: 200 } }],
  };
  const nodes = stepsToNodes(steps, saved);
  expect(nodes.find((n) => n.id === "a")!.position).toEqual({ x: 100, y: 200 });
  // b has no saved position -> deterministic fallback.
  expect(nodes.find((n) => n.id === "b")!.position).toBeDefined();
});

test("stepsToNodes mirrors backend array index into data.order and copies config", () => {
  const steps = [img("first"), img("second")];
  const nodes = stepsToNodes(steps);
  expect(nodes.map((n) => n.data.order)).toEqual([1, 2]);
  expect(nodes[0]!.data.config).not.toBe(steps[0]!.config); // copied, not aliased
});

// --- connect / disconnect patches ---

test("connectionToConfigPatch writes a scalar ref replacement", () => {
  const field = { name: "input_images", label: "x", bucket: "inputs", kind: "ref", default: "", refType: "image" } as const;
  const patch = connectionToConfigPatch(
    { source: "a", target: "b", sourceHandle: "generated_image", targetHandle: "input_images" },
    field,
    {},
  );
  expect(patch).toEqual({ stepId: "b", field: "input_images", value: { step: "a", output: "generated_image" } });
});

test("connectionToConfigPatch appends to a ref-list, deduping identical pairs", () => {
  const field = { name: "input_images", label: "x", bucket: "inputs", kind: "ref-list", default: [], refType: "image" } as const;
  const conn = { source: "b", target: "c", sourceHandle: "generated_image", targetHandle: "input_images" };
  const existing = [{ step: "a", output: "generated_image" }];
  const first = connectionToConfigPatch(conn, field, { input_images: existing });
  expect(first?.value).toEqual([{ step: "a", output: "generated_image" }, { step: "b", output: "generated_image" }]);
  // Idempotent on identical re-connect.
  const second = connectionToConfigPatch(conn, field, first!.value as never);
  expect(second?.value).toEqual([{ step: "a", output: "generated_image" }, { step: "b", output: "generated_image" }]);
});

test("connectionToConfigPatch returns null for non-reference fields", () => {
  const field = { name: "prompt", label: "p", bucket: "inputs", kind: "textarea", default: "" } as const;
  expect(connectionToConfigPatch({ source: "a", target: "b", sourceHandle: "o", targetHandle: "prompt" }, field, {})).toBeNull();
});

test("removeEdgeToConfigPatch clears a scalar ref and removes only the matching ref-list item", () => {
  const scalarField = { name: "input_images", label: "x", bucket: "inputs", kind: "ref", default: "", refType: "image" } as const;
  expect(
    removeEdgeToConfigPatch(
      { id: "x", source: "a", target: "b", sourceHandle: "o", targetHandle: "input_images", refType: "image", cardinality: "scalar" },
      scalarField,
      { input_images: { step: "a", output: "o" } },
    ),
  ).toEqual({ stepId: "b", field: "input_images", value: "" });

  const listField = { name: "input_images", label: "x", bucket: "inputs", kind: "ref-list", default: [], refType: "image" } as const;
  const next = removeEdgeToConfigPatch(
    { id: "x", source: "a", target: "c", sourceHandle: "generated_image", targetHandle: "input_images", refType: "image", cardinality: "list" },
    listField,
    { input_images: [{ step: "a", output: "generated_image" }, { step: "b", output: "generated_image" }] },
  );
  expect(next?.value).toEqual([{ step: "b", output: "generated_image" }]);
});

// --- literal-or-ref fields (acceptsRef): prompt User Input text -> consumers ---

test("isLiteralOrRefField is true only for text/textarea slots that accept refs", () => {
  const prompt = { name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "", acceptsRef: true, refType: "text" } as const;
  const plain = { name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "" } as const;
  const ref = { name: "input_images", label: "x", bucket: "inputs", kind: "ref", default: "", refType: "image" } as const;
  expect(isLiteralOrRefField(prompt)).toBe(true);
  expect(isLiteralOrRefField(plain)).toBe(false);
  expect(isLiteralOrRefField(ref)).toBe(false);
});

test("literal-or-ref prompt: user-input text output connects to text/image/edit/video/audio prompt fields", () => {
  const kinds: Array<WorkflowStep["type"]> = ["text", "image", "edit", "video", "audio"];
  const promptField = { name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "", required: true, acceptsRef: true, refType: "text" } as const;
  for (const k of kinds) {
    const c = { source: "ui", sourceHandle: "prompt", target: k, targetHandle: "prompt" };
    // Connect replaces the literal with a structured BackendInputRef.
    const patch = connectionToConfigPatch(c, promptField, {});
    expect(patch, `connect patch for ${k}`).toEqual({ stepId: k, field: "prompt", value: { step: "ui", output: "prompt" } });
    // The structured ref reads back as a single dependency edge.
    expect(refsForField({ prompt: { step: "ui", output: "prompt" } }, promptField), `refs for ${k}`).toEqual([{ step: "ui", output: "prompt" }]);
    // Legacy exact `step::output` string still round-trips.
    expect(refsForField({ prompt: "ui::prompt" }, promptField), `legacy refs for ${k}`).toEqual([{ step: "ui", output: "prompt" }]);
    // Disconnect restores the empty literal (no ref leaked into prose).
    expect(
      removeEdgeToConfigPatch({ id: "e", source: "ui", target: k, sourceHandle: "prompt", targetHandle: "prompt", refType: "text", cardinality: "scalar" }, promptField, {}),
      `disconnect for ${k}`,
    ).toEqual({ stepId: k, field: "prompt", value: "" });
  }
});

test("literalOrRefValueOf ignores ordinary prose so connected refs never collide with text", () => {
  const cfg = { prompt: "a cat on a mat" } as const;
  expect(literalOrRefValueOf(cfg, "prompt")).toBeNull();
  expect(refsForField(cfg, { name: "prompt", label: "p", bucket: "inputs", kind: "textarea", default: "", acceptsRef: true, refType: "text" } as const)).toEqual([]);
});

// --- generic media ref-lists (image/video): no capability gate, append many ---

test("isModelGatedRefList gates only image-ingredients ref-lists, not generic media", () => {
  const ingredients = { name: "input_images", label: "x", bucket: "inputs", kind: "ref-list", default: [], refType: "image", refListCapability: "image-ingredients" } as const;
  const genericImage = { name: "input_images", label: "x", bucket: "inputs", kind: "ref-list", default: [], refType: "image" } as const;
  const videoFrames = { name: "input_frames", label: "x", bucket: "inputs", kind: "ref-list", default: [], refType: "video" } as const;
  expect(isModelGatedRefList(ingredients)).toBe(true);
  expect(isModelGatedRefList(genericImage)).toBe(false);
  expect(isModelGatedRefList(videoFrames)).toBe(false);
});

test("generic media ref-list (video frames) appends multiple ordered refs with no dedup loss", () => {
  const videoFrames = { name: "input_frames", label: "Input frames", bucket: "inputs", kind: "ref-list", default: [], refType: "video" } as const;
  const first = connectionToConfigPatch({ source: "v1", target: "sink", sourceHandle: "generated_video", targetHandle: "input_frames" }, videoFrames, { input_frames: [] });
  const second = connectionToConfigPatch({ source: "v2", target: "sink", sourceHandle: "generated_video", targetHandle: "input_frames" }, videoFrames, first!.value as BackendInputRef[]);
  expect((second!.value as BackendInputRef[]).map((r) => r.step)).toEqual(["v1", "v2"]);
});

// --- scalar typed targets: vto model_image + scalar video frame ---

test("scalar ref field (vto model_image) connect writes a structured ref and reads it back", () => {
  const modelImage = { name: "model_image", label: "Model image", bucket: "inputs", kind: "ref", default: "", refType: "image", required: true } as const;
  const patch = connectionToConfigPatch({ source: "ui", target: "vto", sourceHandle: "user_image", targetHandle: "model_image" }, modelImage, {});
  expect(patch).toEqual({ stepId: "vto", field: "model_image", value: { step: "ui", output: "user_image" } });
  expect(refsForField({ model_image: { step: "ui", output: "user_image" } }, modelImage)).toEqual([{ step: "ui", output: "user_image" }]);
  expect(
    removeEdgeToConfigPatch({ id: "e", source: "ui", target: "vto", sourceHandle: "user_image", targetHandle: "model_image", refType: "image", cardinality: "scalar" }, modelImage, {}),
  ).toEqual({ stepId: "vto", field: "model_image", value: "" });
});

test("scalar ref field (single video frame) rejects a second source at the patch level by overwrite", () => {
  const frame = { name: "input_frame", label: "Input frame", bucket: "inputs", kind: "ref", default: "", refType: "video", required: true } as const;
  // Scalar connect replaces whatever was there (caller validates occupancy first).
  const patch = connectionToConfigPatch({ source: "v2", target: "sink", sourceHandle: "generated_video", targetHandle: "input_frame" }, frame, {});
  expect(patch).toEqual({ stepId: "sink", field: "input_frame", value: { step: "v2", output: "generated_video" } });
  expect(refsForField({ input_frame: "v2::generated_video" }, frame)).toEqual([{ step: "v2", output: "generated_video" }]);
});

// --- v2 projection: hidden singleton + virtual input nodes (plan §7) ---

test("stepsToNodes hides the singleton and expands one virtual node per param (two virtual nodes)", () => {
  const singleton = ui("user_input", [
    { name: "Prompt", type: "text" },
    { name: "Photo", type: "image" },
  ]);
  const nodes = stepsToNodes([singleton]);
  // The singleton step id is never a node.
  expect(nodes.map((n) => n.id)).not.toContain("user_input");
  // Two virtual nodes, one per param, stable ids, correct kinds.
  expect(nodes).toHaveLength(2);
  const prompt = nodes.find((n) => n.id === virtualInputId("user_input", "prompt"))!;
  const photo = nodes.find((n) => n.id === virtualInputId("user_input", "photo"))!;
  expect(prompt).toBeDefined();
  expect(photo).toBeDefined();
  expect(prompt.data.canvasKind).toBe("text-input");
  expect(photo.data.canvasKind).toBe("image-input");
  // Virtual input nodes carry order: null (no execution badge) and project the singleton.
  expect(prompt.data.order).toBeNull();
  expect(photo.data.order).toBeNull();
  expect(prompt.data.stepId).toBe("user_input");
  expect(photo.data.stepId).toBe("user_input");
});

test("stepsToNodes projects zero virtual nodes for a zero-param singleton and hides the singleton", () => {
  const nodes = stepsToNodes([ui("user_input", []), img("gen")]);
  // No virtual nodes from an empty singleton, and the singleton is hidden.
  expect(nodes.map((n) => n.id)).toEqual(["gen"]);
  expect(nodes.map((n) => n.id)).not.toContain("user_input");
});

test("stepsToNodes never emits an RF node whose id is the singleton step id (no singleton RF node)", () => {
  const nodes = stepsToNodes([ui("user_input", [{ name: "a", type: "text" }]), img("gen")]);
  expect(nodes.map((n) => n.id)).not.toContain("user_input");
  // The only executable node keeps a 1-based order (singleton excluded from counting).
  expect(nodes.find((n) => n.id === "gen")!.data.order).toBe(1);
});

test("stepsToEdges maps a singleton ref source to the virtual display node (edge source mapping)", () => {
  const promptVid = virtualInputId("user_input", "prompt");
  const steps = [
    ui("user_input", [{ name: "Prompt", type: "text" }]),
    txt("t", { config: { prompt: "user_input::prompt", model: "gemini-3-flash-preview", temperature: 0.7 } }),
  ];
  const edges = stepsToEdges(steps);
  expect(edges).toHaveLength(1);
  // The DISPLAY source is the virtual node; the underlying config ref stays the singleton.
  expect(edges[0]!.source).toBe(promptVid);
  expect(edges[0]!.sourceHandle).toBe("prompt");
  expect(edges[0]!.target).toBe("t");
  expect(edges[0]!.targetHandle).toBe("prompt");
  expect(edges[0]!.refType).toBe("text");
  // Config ref is unchanged (singleton is the backend source of truth).
  expect(steps[1]!.config!.prompt).toBe("user_input::prompt");
});

test("stepsToEdges keeps a sibling output's edge intact when only one virtual output is referenced", () => {
  const a = virtualInputId("user_input", "alpha");
  const b = virtualInputId("user_input", "beta");
  const steps = [
    ui("user_input", [
      { name: "alpha", type: "image" },
      { name: "beta", type: "image" },
    ]),
    img("sink", {
      config: {
        prompt: "fuse",
        input_images: [{ step: "user_input", output: "alpha" }, { step: "user_input", output: "beta" }],
      },
    }),
  ];
  const edges = stepsToEdges(steps);
  expect(edges.map((e) => e.source).sort()).toEqual([a, b].sort());
});

// --- v2 ingredients inference through stepsToNodes ---

test("stepsToNodes infers the ingredients canvasKind from a non-empty capability-gated input_images", () => {
  const steps = [
    img("ing", {
      config: {
        prompt: "fuse",
        input_images: [{ step: "src", output: "generated_image" }],
        model: "gemini-3.1-flash-image",
      },
    }),
  ];
  const node = stepsToNodes(steps).find((n) => n.id === "ing")!;
  expect(node.data.canvasKind).toBe("ingredients-image");
});

test("stepsToNodes renders a plain image (no ingredients kind) when input_images is empty", () => {
  const steps = [img("plain", { config: { prompt: "p", model: "gemini-3.1-flash-image" } })];
  const node = stepsToNodes(steps).find((n) => n.id === "plain")!;
  expect(node.data.canvasKind).toBeUndefined();
});

test("stepsToNodes honors an explicit ingredients variant override even with empty input_images", () => {
  const steps = [img("ing", { config: { prompt: "p", model: "gemini-3.1-flash-image" } })];
  const node = stepsToNodes(steps, null, { ing: "ingredients" }).find((n) => n.id === "ing")!;
  expect(node.data.canvasKind).toBe("ingredients-image");
});
