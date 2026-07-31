/** Copyright 2026 Google LLC — Apache-2.0
 * Pure unit tests for the state-orchestration helpers in `use-workflow-canvas`.
 * Bun's built-in runner (no DOM / RTL is installed), so the React hook itself is
 * not exercised here — every rule it enforces lives in these exported pure
 * helpers and in the already-tested graph adapter/validation modules. */
import { describe, expect, test } from "bun:test";

import type { WorkflowStep } from "../../workflow-editor/types";
import type { WorkflowCanvasEdge } from "../graph-types";
import {
  addVirtualInputParam,
  applyConfigPatchToStep,
  applyConnectionAndReorder,
  buildRunDefinition,
  computeParamRename,
  dependentStepIds,
  dependentStepIdsForOutput,
  disconnectEdgesFromSteps,
  fieldForConnection,
  ingredientsValidation,
  logConnectionEvent,
  makeNewStep,
  normalizeConnection,
  reconcileNodes,
  removeStepAndDownstreamRefs,
  removeVirtualInputParam,
  serializeDraftForDirty,
  uniqueParamName,
  type CanvasNode,
} from "../hooks/use-workflow-canvas";
import { stepsToNodes } from "../adapters/graph-adapter";
import { validateConnection, validateExecutionOrder } from "../adapters/graph-validation";
import { virtualInputId } from "../adapters/virtual-inputs";
import { cascadeParamRename } from "../../workflow-editor/hooks/identifiers";
import { extractInputFields } from "../../workflows/components/extract-input-fields";

const step = (id: string, type: WorkflowStep["type"], extra: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id,
  type,
  label: id,
  inputs: [{ mode: "fixed" }],
  ...extra,
});
const img = (id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => {
  const { config: over, ...rest } = extra;
  return step(id, "image", {
    ...rest,
    config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false, ...over },
  });
};
const edit = (id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => {
  const { config: over, ...rest } = extra;
  return step(id, "edit", {
    ...rest,
    config: { input_images: "", prompt: "sharpen", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false, ...over },
  });
};
const conn = (source: string, sourceHandle: string, target: string, targetHandle: string) => ({
  source,
  sourceHandle,
  target,
  targetHandle,
});
const canvasEdge = (
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  cardinality: WorkflowCanvasEdge["cardinality"] = "scalar",
): WorkflowCanvasEdge => ({
  id: `${source}::${sourceHandle}__${target}::${targetHandle}`,
  source,
  sourceHandle,
  target,
  targetHandle,
  refType: sourceHandle.includes("image") ? "image" : "text",
  cardinality,
});

describe("fieldForConnection", () => {
  test("resolves a scalar ref target field", () => {
    // vto.model_image is a genuine scalar `ref` (edit.input_images is now a ref-list).
    const steps = [img("gen"), step("vt", "vto")];
    const field = fieldForConnection(steps, conn("gen", "generated_image", "vt", "model_image"));
    expect(field?.name).toBe("model_image");
    expect(field?.kind).toBe("ref");
  });

  test("resolves a ref-list target field", () => {
    const steps = [img("a"), img("b")];
    const field = fieldForConnection(steps, conn("a", "generated_image", "b", "input_images"));
    expect(field?.kind).toBe("ref-list");
  });

  test("resolves a literal-or-ref textarea target field (aligns with validateConnection)", () => {
    // edit.prompt is a textarea with acceptsRef (literal-or-ref): connectable, so
    // the live isValidConnection gate and connect agree with validateConnection.
    const steps = [img("gen"), edit("ed")];
    const field = fieldForConnection(steps, conn("gen", "generated_text", "ed", "prompt"));
    expect(field?.name).toBe("prompt");
  });

  test("returns undefined for a non-reference handle or unknown target", () => {
    // edit.model is a plain text field (no acceptsRef) -> not connectable.
    const steps = [img("gen"), edit("ed")];
    expect(fieldForConnection(steps, conn("gen", "generated_text", "ed", "model"))).toBeUndefined();
    expect(fieldForConnection(steps, conn("gen", "generated_image", "missing", "input_images"))).toBeUndefined();
  });
});

describe("dependentStepIds (delete downstream guard)", () => {
  test("finds dependents through a scalar ref", () => {
    const steps = [img("gen"), step("vt", "vto", { config: { model_image: "gen::generated_image" } })];
    expect(dependentStepIds(steps, "gen")).toEqual(["vt"]);
    expect(dependentStepIds(steps, "vt")).toEqual([]);
  });

  test("finds dependents through a ref-list entry", () => {
    const steps = [
      img("a"),
      img("b"),
      img("c", { config: { prompt: "fuse", input_images: [{ step: "a", output: "generated_image" }, { step: "b", output: "generated_image" }] } }),
    ];
    expect(dependentStepIds(steps, "a")).toEqual(["c"]);
    expect(dependentStepIds(steps, "b")).toEqual(["c"]);
    expect(dependentStepIds(steps, "c")).toEqual([]);
  });

  test("finds dependents through a loose prompt ref", () => {
    const steps = [
      step("ui", "user-input", { inputParams: [{ name: "prompt", type: "text" }] }),
      step("t", "text", { config: { prompt: "ui::prompt", model: "m", temperature: 0.7 } }),
    ];
    expect(dependentStepIds(steps, "ui")).toEqual(["t"]);
  });

  test("returns [] for an unknown target id", () => {
    expect(dependentStepIds([img("a")], "nope")).toEqual([]);
  });
});

describe("applyConfigPatchToStep", () => {
  test("writes a scalar ref and preserves other config", () => {
    const s = edit("ed");
    const next = applyConfigPatchToStep(s, { stepId: "ed", field: "input_images", value: { step: "gen", output: "generated_image" } });
    expect(next.config?.input_images).toEqual({ step: "gen", output: "generated_image" });
    expect(next.config?.prompt).toBe("sharpen");
    // Original step config is not mutated.
    expect(s.config?.input_images).toBe("");
  });

  test("writes a ref-list value", () => {
    const s = img("sink", { config: { prompt: "fuse", input_images: [] } });
    const next = applyConfigPatchToStep(s, {
      stepId: "sink",
      field: "input_images",
      value: [{ step: "a", output: "generated_image" }],
    });
    expect(next.config?.input_images).toEqual([{ step: "a", output: "generated_image" }]);
  });

  test('clears a scalar ref with the "" sentinel', () => {
    const s = edit("ed", { config: { input_images: "gen::generated_image", prompt: "sharpen", model: "m", aspect_ratio: "1:1", brand_guidelines: false } });
    const next = applyConfigPatchToStep(s, { stepId: "ed", field: "input_images", value: "" });
    expect(next.config?.input_images).toBe("");
  });

  test("defaults config when the step had none", () => {
    const bare = step("ed", "edit", { config: undefined });
    const next = applyConfigPatchToStep(bare, { stepId: "ed", field: "input_images", value: "" });
    expect(next.config?.input_images).toBe("");
    // defaultStepConfig("edit") supplies prompt/model/aspect_ratio/brand_guidelines.
    expect(typeof next.config?.prompt).toBe("string");
  });
});

describe("applyConnectionAndReorder (graph-derived execution order)", () => {
  test("applies an Edit to Video edge before sorting so the source executes first", () => {
    const video = step("video", "video", {
      config: {
        prompt: "Animate",
        model: "veo-3.0-generate-preview",
        aspect_ratio: "16:9",
        input_images: [],
        brand_guidelines: false,
      },
    });
    const sourceEdit = edit("edit");

    const reordered = applyConnectionAndReorder([video, sourceEdit], {
      stepId: "video",
      field: "input_images",
      value: [{ step: "edit", output: "edited_image" }],
    });

    expect(reordered.map((item) => item.id)).toEqual(["edit", "video"]);
    expect(reordered[1].config?.input_images).toEqual([{ step: "edit", output: "edited_image" }]);
    expect(validateExecutionOrder(reordered)).toEqual({ ok: true, violations: [] });
  });
});

describe("buildRunDefinition (no DTO mapper)", () => {
  test("derives user_input fields directly from inputParams", () => {
    const steps = [
      step("ui", "user-input", { inputParams: [{ name: "My Prompt", type: "text" }, { name: "Photo", type: "image" }] }),
      img("gen"),
    ];
    const def = buildRunDefinition(steps);
    expect(def.steps).toHaveLength(1);
    expect(def.steps[0]).toEqual({
      type: "user_input",
      outputs: { my_prompt: { type: "text" }, photo: { type: "image" } },
    });
  });

  test("feeds the run modal's extractInputFields (name + type round-trip)", () => {
    const steps = [step("ui", "user-input", { inputParams: [{ name: "Prompt", type: "text" }, { name: "Reference Photo", type: "image" }] })];
    expect(extractInputFields(buildRunDefinition(steps))).toEqual([
      { name: "prompt", type: "text" },
      { name: "reference_photo", type: "image" },
    ]);
  });

  test("returns an empty step list when there is no user_input step", () => {
    expect(buildRunDefinition([img("a")]).steps).toEqual([]);
  });
});

describe("serializeDraftForDirty", () => {
  test("is stable for an unchanged draft and ignores legacy outputRef/inputs", () => {
    const a = step("x", "image", { outputRef: "y::generated_image", config: { prompt: "p", model: "m", aspect_ratio: "1:1", brand_guidelines: false } });
    const b = step("x", "image", { outputRef: "z::generated_image", inputs: [{ mode: "linked", sourceStepId: "y" }], config: { prompt: "p", model: "m", aspect_ratio: "1:1", brand_guidelines: false } });
    const draft = { name: "n", description: "", definition: { steps: [a] } };
    const draftLegacy = { name: "n", description: "", definition: { steps: [b] } };
    expect(serializeDraftForDirty(draft)).toBe(serializeDraftForDirty(draftLegacy));
  });

  test("changes when name, config, or inputParams change", () => {
    const base = { name: "n", description: "", definition: { steps: [step("ui", "user-input", { inputParams: [{ name: "a", type: "text" }] })] } };
    const renamed = { ...base, name: "n2" };
    const reparam = { ...base, definition: { steps: [step("ui", "user-input", { inputParams: [{ name: "b", type: "text" }] })] } };
    expect(serializeDraftForDirty(base)).not.toBe(serializeDraftForDirty(renamed));
    expect(serializeDraftForDirty(base)).not.toBe(serializeDraftForDirty(reparam));
  });
});

describe("makeNewStep", () => {
  test("builds a generated step with default config and a humanized label", () => {
    const s = makeNewStep("image", "image_1");
    expect(s.id).toBe("image_1");
    expect(s.label).toBe("image");
    expect(s.config?.prompt).toBe("");
    expect(s.inputParams).toBeUndefined();
  });

  test("user-input steps start with an empty parameter list", () => {
    const s = makeNewStep("user-input", "user_input_1");
    expect(s.inputParams).toEqual([]);
    expect(s.config).toBeUndefined(); // STEP_FIELDS["user-input"] is empty -> no config.
  });

  test("the id is identifier-safe (no raw hyphenated uuid)", () => {
    expect(makeNewStep("vto", "vto_1").id).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
  });
});

describe("removeStepAndDownstreamRefs (confirmed force-delete cleanup)", () => {
  test("clears a scalar downstream ref and drops the target node", () => {
    const gen = img("gen");
    const vt = step("vt", "vto", { config: { model_image: "gen::generated_image" } });
    const out = removeStepAndDownstreamRefs([gen, vt], "gen");
    expect(out.map((s) => s.id)).toEqual(["vt"]);
    // Downstream scalar ref cleared with the "" sentinel — no dangling ref.
    expect(out[0].config?.model_image).toBe("");
  });

  test("drops only the matching ref-list entry, preserving order and the node is removed", () => {
    const a = img("a");
    const b = img("b");
    const sink = img("c", {
      config: {
        prompt: "fuse",
        input_images: [
          { step: "a", output: "generated_image" },
          { step: "b", output: "generated_image" },
        ],
      },
    });
    const out = removeStepAndDownstreamRefs([a, b, sink], "b");
    expect(out.map((s) => s.id)).toEqual(["a", "c"]);
    expect(out[1].config?.input_images).toEqual([{ step: "a", output: "generated_image" }]);
  });

  test("clears a loose whole-value prompt ref to the deleted node", () => {
    const ui = step("ui", "user-input", { inputParams: [{ name: "prompt", type: "text" }] });
    const t = step("t", "text", { config: { prompt: "ui::prompt", model: "m", temperature: 0.7 } });
    const out = removeStepAndDownstreamRefs([ui, t], "ui");
    expect(out.map((s) => s.id)).toEqual(["t"]);
    expect(out[0].config?.prompt).toBe("");
  });

  test("clears refs across every downstream step in one pass", () => {
    const gen = img("gen");
    const vt = step("vt", "vto", { config: { model_image: "gen::generated_image" } });
    const sink = img("sink", { config: { prompt: "fuse", input_images: [{ step: "gen", output: "generated_image" }] } });
    const out = removeStepAndDownstreamRefs([gen, vt, sink], "gen");
    expect(out.map((s) => s.id)).toEqual(["vt", "sink"]);
    expect(out[0].config?.model_image).toBe("");
    expect(out[1].config?.input_images).toEqual([]);
  });

  test("removes a node with no downstream dependents", () => {
    const a = img("a");
    const b = img("b");
    expect(removeStepAndDownstreamRefs([a, b], "b").map((s) => s.id)).toEqual(["a"]);
  });

  test("returns the array unchanged for an unknown target id", () => {
    const a = img("a");
    const input = [a];
    expect(removeStepAndDownstreamRefs(input, "nope")).toBe(input);
  });

  test("does not mutate the input steps", () => {
    const ed = edit("ed", { config: { input_images: "gen::generated_image", prompt: "sharpen", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false } });
    removeStepAndDownstreamRefs([img("gen"), ed], "gen");
    expect(ed.config?.input_images).toBe("gen::generated_image");
  });
});

describe("disconnectEdgesFromSteps (direct connector deletion)", () => {
  test("clears scalar and literal-or-ref connections", () => {
    const source = img("source");
    const target = step("target", "vto", {
      config: { model_image: { step: "source", output: "generated_image" } },
    });
    const textSource = step("ui", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] });
    const textTarget = step("text", "text", {
      config: { prompt: { step: "ui", output: "prompt" }, model: "m", temperature: 0.7 },
    });

    const out = disconnectEdgesFromSteps(
      [source, target, textSource, textTarget],
      [
        canvasEdge("source", "generated_image", "target", "model_image"),
        canvasEdge(virtualInputId("ui", "prompt"), "prompt", "text", "prompt"),
      ],
    );

    expect(out.find((item) => item.id === "target")?.config?.model_image).toBe("");
    expect(out.find((item) => item.id === "text")?.config?.prompt).toBe("");
  });

  test("atomically removes multiple entries from the same ordered ref-list", () => {
    const target = img("target", {
      config: {
        input_images: [
          { step: "a", output: "generated_image" },
          { step: "b", output: "generated_image" },
          { step: "c", output: "generated_image" },
        ],
      },
    });
    const out = disconnectEdgesFromSteps(
      [img("a"), img("b"), img("c"), target],
      [
        canvasEdge("a", "generated_image", "target", "input_images", "list"),
        canvasEdge("c", "generated_image", "target", "input_images", "list"),
      ],
    );
    expect(out.at(-1)?.config?.input_images).toEqual([{ step: "b", output: "generated_image" }]);
  });

  test("returns the original array when no edges are selected", () => {
    const steps = [img("a")];
    expect(disconnectEdgesFromSteps(steps, [])).toBe(steps);
  });
});

describe("computeParamRename (rename-cascade detection)", () => {
  const p = (name: string, type: "text" | "image" = "text") => ({ name, type });

  test("detects an isolated single rename by normalized output", () => {
    expect(computeParamRename([p("Prompt"), p("Photo", "image")], [p("Question"), p("Photo", "image")])).toEqual({
      oldOutput: "prompt",
      newOutput: "question",
    });
  });

  test("is a no-op for a pure add", () => {
    expect(computeParamRename([p("Prompt")], [p("Prompt"), p("Photo", "image")])).toBeNull();
  });

  test("is a no-op for a pure remove", () => {
    expect(computeParamRename([p("Prompt"), p("Photo", "image")], [p("Prompt")])).toBeNull();
  });

  test("is a no-op for a reorder (outputs unchanged)", () => {
    expect(computeParamRename([p("Prompt"), p("Photo", "image")], [p("Photo", "image"), p("Prompt")])).toBeNull();
  });

  test("still detects a rename that was also reordered", () => {
    expect(computeParamRename([p("Prompt"), p("Photo", "image")], [p("Photo", "image"), p("Question")])).toEqual({
      oldOutput: "prompt",
      newOutput: "question",
    });
  });

  test("is a no-op for two simultaneous renames (ambiguous pairing)", () => {
    expect(computeParamRename([p("A"), p("B")], [p("C"), p("D")])).toBeNull();
  });

  test("normalizes leading-digit / spaced names when pairing", () => {
    expect(computeParamRename([p("My Prompt")], [p("My Question")])).toEqual({
      oldOutput: "my_prompt",
      newOutput: "my_question",
    });
  });
});

describe("reconcileNodes (projection-based controlled-node reconciliation)", () => {
  // RF-managed public fields the pure graph type omits; the reconciler must carry
  // them through (spread) instead of replacing the node wholesale (plan §4–§9).
  type RfNode = CanvasNode & {
    measured?: { width: number; height: number };
    width?: number;
    height?: number;
    dragging?: boolean;
  };

  test("preserves existing position/selection and RF measured fields while replacing data", () => {
    const prev: RfNode[] = [
      {
        id: "gen",
        type: "image",
        position: { x: 10, y: 20 },
        selected: true,
        measured: { width: 220, height: 120 },
        width: 220,
        height: 120,
        dragging: true,
        data: { stepId: "gen", stepType: "image", label: "stale", config: {}, validation: [], order: 99 },
      },
    ];
    const out = reconcileNodes([img("gen")], prev, { gen: ["needs prompt"] }, new Map()) as RfNode[];
    const node = out[0];
    // Canonical data replaced.
    expect(node.data.order).toBe(1);
    expect(node.data.label).toBe("gen");
    expect(node.data.validation).toEqual(["needs prompt"]);
    // Canvas-owned + RF-managed public fields preserved (not reset).
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.selected).toBe(true);
    expect(node.measured).toEqual({ width: 220, height: 120 });
    expect(node.width).toBe(220);
    expect(node.height).toBe(120);
    expect(node.dragging).toBe(true);
  });

  test("a brand-new node takes a requested pending position and consumes it", () => {
    const pending = new Map([["gen", { x: 5, y: 7 }]]);
    const out = reconcileNodes([img("gen")], [], {}, pending);
    expect(out[0].position).toEqual({ x: 5, y: 7 });
    // Pending position consumed so a later drag wins.
    expect(pending.has("gen")).toBe(false);
  });

  test("falls back to the stepsToNodes deterministic projection when no position is known", () => {
    const projected = stepsToNodes([img("gen")], null);
    expect(reconcileNodes([img("gen")], [], {}, new Map())[0].position).toEqual(projected[0].position);
  });

  test("derives 1-based order and per-node validation from the steps", () => {
    const out = reconcileNodes([img("a"), img("b")], [], { b: ["cycle"] }, new Map());
    expect(out.map((n) => n.data.order)).toEqual([1, 2]);
    expect(out[1].data.validation).toEqual(["cycle"]);
    expect(out[0].data.validation).toEqual([]);
  });

  test("drops nodes whose step was removed (edges re-derive separately)", () => {
    const prev: CanvasNode[] = [
      { id: "a", type: "image", position: { x: 0, y: 0 }, data: { stepId: "a", stepType: "image", label: "a", config: {}, validation: [], order: 1 } },
      { id: "gone", type: "image", position: { x: 9, y: 9 }, data: { stepId: "gone", stepType: "image", label: "gone", config: {}, validation: [], order: 2 } },
    ];
    const out = reconcileNodes([img("a")], prev, {}, new Map());
    expect(out.map((n) => n.id)).toEqual(["a"]);
  });

  test("a new node does not inherit selected from a non-existent prev", () => {
    expect(reconcileNodes([img("gen")], [], {}, new Map())[0].selected).toBe(false);
  });

  test("projects two virtual input nodes and hides the singleton (order null)", () => {
    const singleton = step("user_input", "user-input", {
      inputParams: [{ name: "Prompt", type: "text" }, { name: "Photo", type: "image" }],
    });
    const out = reconcileNodes([singleton], [], {}, new Map());
    expect(out.map((n) => n.id)).not.toContain("user_input");
    expect(out).toHaveLength(2);
    expect(out.every((n) => n.data.order === null)).toBe(true);
    expect(out.find((n) => n.id === virtualInputId("user_input", "prompt"))!.data.canvasKind).toBe("text-input");
    expect(out.find((n) => n.id === virtualInputId("user_input", "photo"))!.data.canvasKind).toBe("image-input");
  });

  test("virtual input nodes carry empty validation; real executable nodes get byNode", () => {
    const singleton = step("user_input", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] });
    const out = reconcileNodes([singleton, img("gen")], [], { gen: ["missing prompt"], user_input: ["dup param"] }, new Map());
    const virtual = out.find((n) => n.data.canvasKind === "text-input")!;
    const real = out.find((n) => n.id === "gen")!;
    expect(virtual.data.validation).toEqual([]);
    expect(real.data.validation).toEqual(["missing prompt"]);
  });

  test("projects an Ingredients variant node from the canvas-only marker", () => {
    const out = reconcileNodes([img("ing", { config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false } })], [], {}, new Map(), { ing: "ingredients" });
    const node = out.find((n) => n.id === "ing")!;
    expect(node.data.canvasKind).toBe("ingredients-image");
    expect(node.data.order).toBe(1);
  });
});

describe("logConnectionEvent (dev-only structured connection logging)", () => {
  const c = conn("a", "generated_image", "b", "input_images");

  /** Capture console.debug calls without any mock framework. */
  function captureDebug(): { calls: Array<{ tag: unknown; payload: unknown }>; restore: () => void } {
    const original = console.debug;
    const calls: Array<{ tag: unknown; payload: unknown }> = [];
    const shim = (...args: unknown[]) => {
      calls.push({ tag: args[0], payload: args[1] });
    };
    console.debug = shim as typeof console.debug;
    return { calls, restore: () => { console.debug = original; } };
  }

  test("logs only connection ids (no prompt/config/workflow payload) in development", () => {
    const { calls, restore } = captureDebug();
    try {
      logConnectionEvent("applied", c);
    } finally {
      restore();
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].tag).toBe("[workflow-canvas:connect]");
    expect(calls[0].payload).toEqual({
      event: "applied",
      source: "a",
      sourceHandle: "generated_image",
      target: "b",
      targetHandle: "input_images",
    });
  });

  test("includes a short reason when provided", () => {
    const { calls, restore } = captureDebug();
    try {
      logConnectionEvent("reject", c, "cycle detected");
    } finally {
      restore();
    }
    expect(calls[0].payload).toMatchObject({ reason: "cycle detected" });
  });

  test("is a no-op in production", () => {
    const originalEnv = process.env.NODE_ENV;
    Reflect.set(process.env, "NODE_ENV", "production");
    const { calls, restore } = captureDebug();
    try {
      logConnectionEvent("applied", c);
    } finally {
      restore();
      Reflect.set(process.env, "NODE_ENV", originalEnv);
    }
    expect(calls).toHaveLength(0);
  });
});

// --- v2: add unique virtual input param (stable id, singleton at index 0) ---

describe("uniqueParamName (add unique)", () => {
  test("generates a unique human-facing name per type with no normalized collision", () => {
    expect(uniqueParamName([], "text")).toBe("Text Input 1");
    expect(uniqueParamName([], "image")).toBe("Image Input 1");
    // Existing text param increments only the text counter; image is independent.
    expect(uniqueParamName([{ name: "Text Input 1", type: "text" }], "text")).toBe("Text Input 2");
    expect(uniqueParamName([{ name: "Text Input 1", type: "text" }], "image")).toBe("Image Input 1");
  });

  test("avoids a normalized-output collision by skipping taken slots", () => {
    // "Text Input 1" normalizes to text_input_1; the second add must skip to 2.
    const first = uniqueParamName([], "text");
    const second = uniqueParamName([{ name: first, type: "text" }], "text");
    expect(second).toBe("Text Input 2");
  });
});

describe("addVirtualInputParam (append one unique param on the hidden singleton)", () => {
  test("appends a param to an existing singleton and returns the stable virtual id", () => {
    const singleton = step("user_input", "user-input", { inputParams: [] });
    const { steps, virtualId } = addVirtualInputParam([singleton], "text");
    const ui2 = steps.find((s) => s.id === "user_input")!;
    expect(ui2.inputParams).toEqual([{ name: "Text Input 1", type: "text" }]);
    expect(virtualId).toBe(virtualInputId("user_input", "text_input_1"));
    // Array length unchanged (singleton retained), no new backend step.
    expect(steps).toHaveLength(1);
  });

  test("creates the singleton at index 0 when none exists", () => {
    const { steps, virtualId } = addVirtualInputParam([img("gen")], "image");
    expect(steps[0]!.type).toBe("user-input");
    expect(steps.map((s) => s.id)).toContain("gen");
    expect(steps).toHaveLength(2);
    expect(virtualId.startsWith(steps[0]!.id)).toBe(true);
  });

  test("multiple input nodes are allowed: each add yields a unique param + id", () => {
    const steps = addVirtualInputParam([step("user_input", "user-input", { inputParams: [] })], "text").steps;
    const a = addVirtualInputParam(steps, "text");
    const b = addVirtualInputParam(a.steps, "image");
    const uiFinal = b.steps.find((s) => s.id === "user_input")!;
    expect(uiFinal.inputParams!.map((p) => p.name)).toEqual(["Text Input 1", "Text Input 2", "Image Input 1"]);
    expect(a.virtualId).not.toBe(b.virtualId);
  });
});

// --- v2: virtual connect normalization (resolve virtual source to singleton) ---

describe("virtual connect normalization (connect resolves virtual source to singleton before patch)", () => {
  test("a virtual source id resolves to the backend singleton ref, not the virtual id", () => {
    const singleton = step("user_input", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] });
    const target = step("t", "text", { config: { prompt: "", model: "gemini-3-flash-preview", temperature: 0.7 } });
    const virtualId = virtualInputId("user_input", "prompt");
    // The hook resolves a virtual source to {singleton, output} before validate/patch.
    const resolved = { step: singleton.id, output: "prompt" };
    const patch = applyConfigPatchToStep(target, { stepId: "t", field: "prompt", value: resolved });
    // The CONFIG ref written is the backend singleton ref (never the virtual id).
    expect(patch.config!.prompt).toEqual({ step: "user_input", output: "prompt" });
    expect(patch.config!.prompt).not.toEqual({ step: virtualId, output: "prompt" });
  });
});

// --- v2: shared normalizeConnection helper (drives BOTH isValidConnection and connect) ---

describe("normalizeConnection (shared virtual-source normalization for live gate + connect)", () => {
  test("a virtual source id resolves to the singleton step id + normalized output", () => {
    const out = normalizeConnection({
      source: virtualInputId("user_input", "prompt"),
      target: "t",
      sourceHandle: "prompt",
      targetHandle: "prompt",
    });
    expect(out).toEqual({ source: "user_input", sourceHandle: "prompt", target: "t", targetHandle: "prompt" });
  });

  test("a non-virtual source passes through unchanged (no normalization, idempotent)", () => {
    const c = { source: "gen", sourceHandle: "generated_text", target: "t", targetHandle: "prompt" };
    expect(normalizeConnection(c)).toBe(c);
    // Calling twice is a no-op: normalized source has no delimiter, so the second
    // pass returns the same object — guards against double-normalization drift.
    expect(normalizeConnection(normalizeConnection(c))).toBe(c);
  });

  test("Text virtual source accepted on a compatible text target field", () => {
    const steps = [
      step("user_input", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] }),
      step("t", "text", { config: { prompt: "", model: "gemini-3-flash-preview", temperature: 0.7 } }),
    ];
    const effective = normalizeConnection({
      source: virtualInputId("user_input", "prompt"),
      sourceHandle: "prompt",
      target: "t",
      targetHandle: "prompt",
    });
    expect(fieldForConnection(steps, effective)).toBeDefined();
    const result = validateConnection({ steps, conn: effective });
    expect(result.ok).toBe(true);
  });

  test("Image virtual source accepted on a compatible image ref-list target field", () => {
    const steps = [
      step("user_input", "user-input", { inputParams: [{ name: "Photo", type: "image" }] }),
      edit("sink"),
    ];
    const effective = normalizeConnection({
      source: virtualInputId("user_input", "photo"),
      sourceHandle: "photo",
      target: "sink",
      targetHandle: "input_images",
    });
    expect(fieldForConnection(steps, effective)).toBeDefined();
    const result = validateConnection({ steps, conn: effective });
    expect(result.ok).toBe(true);
  });

  test("Text virtual source rejected on an image ref-list target field (type mismatch)", () => {
    const steps = [
      step("user_input", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] }),
      edit("sink"),
    ];
    const effective = normalizeConnection({
      source: virtualInputId("user_input", "prompt"),
      sourceHandle: "prompt",
      target: "sink",
      targetHandle: "input_images",
    });
    const result = validateConnection({ steps, conn: effective });
    expect(result.ok).toBe(false);
    expect(result.requiresReorder).toBeFalsy();
    expect(result.reason).toMatch(/type mismatch/i);
  });

  test("Image virtual source rejected on a text target field (type mismatch)", () => {
    const steps = [
      step("user_input", "user-input", { inputParams: [{ name: "Photo", type: "image" }] }),
      step("t", "text", { config: { prompt: "", model: "gemini-3-flash-preview", temperature: 0.7 } }),
    ];
    const effective = normalizeConnection({
      source: virtualInputId("user_input", "photo"),
      sourceHandle: "photo",
      target: "t",
      targetHandle: "prompt",
    });
    const result = validateConnection({ steps, conn: effective });
    expect(result.ok).toBe(false);
    expect(result.requiresReorder).toBeFalsy();
    expect(result.reason).toMatch(/type mismatch/i);
  });

  test("source after target signals the automatic reorder path while remaining valid for drop", () => {
    // Target BEFORE the singleton in execution order: sourceIdx > targetIdx.
    const steps = [
      step("t", "text", { config: { prompt: "", model: "gemini-3-flash-preview", temperature: 0.7 } }),
      step("user_input", "user-input", { inputParams: [{ name: "Prompt", type: "text" }] }),
    ];
    const effective = normalizeConnection({
      source: virtualInputId("user_input", "prompt"),
      sourceHandle: "prompt",
      target: "t",
      targetHandle: "prompt",
    });
    const result = validateConnection({ steps, conn: effective });
    // The live isValidConnection gate allows the drop (ok || requiresReorder).
    expect(result.ok || Boolean(result.requiresReorder)).toBe(true);
    // The final connect path applies the edge and stable reorder automatically.
    expect(result.requiresReorder).toBe(true);
    expect(result.reason).toMatch(/after target/i);
  });
});

// --- v2: exact-delete sibling safety for one virtual input ---

describe("dependentStepIdsForOutput (exact-output delete guard)", () => {
  test("finds dependents of exactly one output, leaving sibling-output dependents untouched", () => {
    const steps = [
      step("user_input", "user-input", { inputParams: [{ name: "alpha", type: "image" }, { name: "beta", type: "image" }] }),
      img("sink", {
        config: {
          prompt: "fuse",
          input_images: [
            { step: "user_input", output: "alpha" },
            { step: "user_input", output: "beta" },
          ],
        },
      }),
    ];
    // Deleting the "alpha" virtual input sees the sink as a dependent.
    expect(dependentStepIdsForOutput(steps, "user_input", "alpha")).toEqual(["sink"]);
    expect(dependentStepIdsForOutput(steps, "user_input", "beta")).toEqual(["sink"]);
    // A non-existent output has no dependents.
    expect(dependentStepIdsForOutput(steps, "user_input", "gone")).toEqual([]);
  });
});

describe("removeVirtualInputParam (force delete clears only one output + param, leaves singleton)", () => {
  test("clears only the targeted output's refs and drops the matching param; siblings intact", () => {
    const steps = [
      step("user_input", "user-input", { inputParams: [{ name: "alpha", type: "image" }, { name: "beta", type: "image" }] }),
      img("sink", {
        config: {
          prompt: "fuse",
          input_images: [
            { step: "user_input", output: "alpha" },
            { step: "user_input", output: "beta" },
          ],
        },
      }),
    ];
    const out = removeVirtualInputParam(steps, "user_input", "alpha");
    const ui2 = out.find((s) => s.id === "user_input")!;
    const sink = out.find((s) => s.id === "sink")!;
    // Only the "alpha" param dropped; singleton retained (not empty yet).
    expect(ui2.inputParams!.map((p) => p.name)).toEqual(["beta"]);
    // Only the "alpha" ref-list entry removed; "beta" ref preserved.
    expect(sink.config!.input_images).toEqual([{ step: "user_input", output: "beta" }]);
    // Original input not mutated (pure).
    expect(steps[1]!.config!.input_images).toHaveLength(2);
  });

  test("leaves an empty singleton when the last param is removed", () => {
    const steps = [step("user_input", "user-input", { inputParams: [{ name: "only", type: "text" }] })];
    const out = removeVirtualInputParam(steps, "user_input", "only");
    expect(out.map((s) => s.id)).toEqual(["user_input"]);
    expect(out[0]!.inputParams).toEqual([]);
  });
});

// --- v2: rename/position migration (cascade refs + new stable virtual id) ---

describe("rename/position migration", () => {
  test("cascadeParamRename rewrites a declared ref-list to the new normalized output", () => {
    const steps = [
      step("user_input", "user-input", { inputParams: [{ name: "photo", type: "image" }] }),
      img("gen", { config: { prompt: "fuse", input_images: [{ step: "user_input", output: "photo" }] } }),
    ];
    const cascaded = cascadeParamRename(steps, "user_input", "photo", "picture");
    expect(cascaded[1]!.config!.input_images).toEqual([{ step: "user_input", output: "picture" }]);
  });

  test("a rename changes the stable virtual id so the position migrates to the new id", () => {
    const oldId = virtualInputId("user_input", "photo");
    const newId = virtualInputId("user_input", "picture");
    expect(oldId).not.toBe(newId);
    // The hook migrates pending/live position keyed oldId -> newId on rename.
  });

  test("renaming a Text Input cascades its prompt refs (Generate Text + Image) and migrates the virtual id; sibling refs untouched", () => {
    // Text Input param `headline` is wired into BOTH a Generate Text prompt (string
    // whole-value ref) and a Generate Image prompt (structured whole-value ref). A
    // sibling ref-list entry to a DIFFERENT output (`tagline`) must survive untouched.
    const steps = [
      step("user_input", "user-input", {
        inputParams: [
          { name: "headline", type: "text" },
          { name: "tagline", type: "text" },
        ],
      }),
      step("gen_text", "text", { config: { prompt: "user_input::headline" } }),
      img("gen_image", {
        config: { prompt: { step: "user_input", output: "headline" }, input_images: [{ step: "user_input", output: "tagline" }] },
      }),
    ];
    const cascaded = cascadeParamRename(steps, "user_input", "headline", "title");
    // Prompt refs retargeted to the new output; representation preserved.
    expect(cascaded[1]!.config!.prompt).toBe("user_input::title");
    expect(cascaded[2]!.config!.prompt).toEqual({ step: "user_input", output: "title" });
    // Sibling ref to a different output untouched.
    expect(cascaded[2]!.config!.input_images).toEqual([{ step: "user_input", output: "tagline" }]);
    // Stable virtual id migrates: the renamed param is a new node id.
    expect(virtualInputId("user_input", "headline")).not.toBe(virtualInputId("user_input", "title"));
  });
});

// --- v2: Ingredients-to-Image save-block augmentation ---

describe("ingredientsValidation (Ingredients blocking until connected)", () => {
  test("flags an Ingredients variant with no input_images edge as save-blocking", () => {
    const steps = [img("ing", { config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false } })];
    const res = ingredientsValidation(steps, { ing: "ingredients" });
    expect(res.errors).toHaveLength(1);
    expect(res.byNode.ing).toHaveLength(1);
  });

  test("passes once at least one input_images edge is connected", () => {
    const steps = [img("ing", { config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false, input_images: [{ step: "src", output: "generated_image" }] } })];
    expect(ingredientsValidation(steps, { ing: "ingredients" })).toEqual({ errors: [], byNode: {} });
  });

  test("ignores a plain image variant marker", () => {
    const steps = [img("ing", { config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false } })];
    expect(ingredientsValidation(steps, { ing: "image" })).toEqual({ errors: [], byNode: {} });
  });
});
