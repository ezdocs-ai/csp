/** Copyright 2026 Google LLC — Apache-2.0
 * Pure unit tests for the composition helpers exported from
 * `workflow-canvas-editor`. The component body needs a React Flow context, so it
 * is covered through integration/E2E; every rule the editor enforces on props
 * lives in these pure helpers. Bun's built-in runner (no DOM / RTL). */
import { describe, expect, test } from "bun:test";

import type { WorkflowStep } from "@/src/features/workflow-editor/types";
import type { WorkflowCanvasEdge, WorkflowCanvasNodeData } from "../../graph-types";
import type { StepFieldSpec } from "@/src/features/workflow-editor/hooks/step-configs";
import {
  buildInspectorRefFields,
  classifyNavigationTarget,
  countValidationIssues,
  fieldAcceptsRef,
  findDisconnectEdge,
  incomingEdgesTo,
  readDropKind,
  SKIP_TO_CANVAS_LINK_CLASS,
  TOOLBAR_WRAPPER_CLASS,
} from "../workflow-canvas-editor";

const dataFor = (over: Partial<WorkflowCanvasNodeData> = {}): WorkflowCanvasNodeData => ({
  stepId: "ed",
  stepType: "edit",
  label: "Edit",
  config: { input_images: "", prompt: "sharpen", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false },
  validation: [],
  order: 2,
  ...over,
});

describe("readDropKind (palette DnD payload via parseDragKind)", () => {
  // Bun's runner has no DOM, so stub the DataTransfer surface readDropKind touches.
  const transfer = (value: string): DataTransfer => ({ getData: () => value }) as unknown as DataTransfer;

  test("returns the dragged palette kind (CanvasAddKind, no StepType cast)", () => {
    expect(readDropKind(transfer("image"))).toBe("image");
    expect(readDropKind(transfer("ingredients-image"))).toBe("ingredients-image");
    expect(readDropKind(transfer("text-input"))).toBe("text-input");
    expect(readDropKind(transfer("vto"))).toBe("vto");
  });

  test("returns null for an empty/foreign payload", () => {
    expect(readDropKind(transfer(""))).toBeNull();
    expect(readDropKind(transfer("not-a-kind"))).toBeNull();
    expect(readDropKind(null)).toBeNull();
  });

  test("rejects the hidden user-input singleton (never a palette drag kind)", () => {
    // The v2 palette exposes text-input/image-input instead; a stray user-input
    // payload must NOT be cast to a step type and added.
    expect(readDropKind(transfer("user-input"))).toBeNull();
  });
});

describe("incomingEdgesTo (force-delete target set)", () => {
  const edges: WorkflowCanvasEdge[] = [
    { id: "e1", source: "a", target: "sink", sourceHandle: "generated_image", targetHandle: "input_images", refType: "image", cardinality: "scalar" },
    { id: "e2", source: "b", target: "other", sourceHandle: "generated_image", targetHandle: "input_images", refType: "image", cardinality: "scalar" },
    { id: "e3", source: "c", target: "sink", sourceHandle: "generated_image", targetHandle: "input_images", refType: "image", cardinality: "list" },
  ];

  test("keeps only edges terminating at the node", () => {
    expect(incomingEdgesTo(edges, "sink").map((edge) => edge.id)).toEqual(["e1", "e3"]);
    expect(incomingEdgesTo(edges, "missing")).toEqual([]);
  });
});

describe("countValidationIssues", () => {
  test("unions graph + editor errors without double counting", () => {
    expect(countValidationIssues([], [])).toBe(0);
    expect(countValidationIssues(["cycle"], ["Workflow name is required."])).toBe(2);
    expect(countValidationIssues(["cycle", "cycle"], ["cycle"])).toBe(1);
  });
});

describe("buildInspectorRefFields", () => {
  const steps: WorkflowStep[] = [
    { id: "gen", type: "image", label: "Gen", inputs: [{ mode: "fixed" }], config: { prompt: "p", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false } },
    { id: "ed", type: "edit", label: "Edit", inputs: [{ mode: "fixed" }], config: { input_images: "gen::generated_image", prompt: "sharpen", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false } },
  ];

  test("resolves a ref-list connection with the source step label", () => {
    const node = dataFor({ config: { input_images: [{ step: "gen", output: "generated_image" }], prompt: "sharpen", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false } });
    const fields = buildInspectorRefFields(node, steps, {});
    const inputImages = fields.find((field) => field.field.name === "input_images");
    expect(inputImages?.connections).toHaveLength(1);
    expect(inputImages?.connections[0].sourceLabel).toBe("Gen");
    expect(inputImages?.connections[0].ref).toEqual({ step: "gen", output: "generated_image" });
  });

  test("hides capacity/handle for a ref-list on a model without multi-image support", () => {
    const node = dataFor({
      stepType: "image",
      config: { prompt: "fuse", input_images: [{ step: "gen", output: "generated_image" }], model: "unsupported-image-model", aspect_ratio: "1:1", brand_guidelines: false },
    });
    const fields = buildInspectorRefFields(node, steps, { "unsupported-image-model": { multiImageInput: false, maxImageInputs: 0 } });
    const list = fields.find((field) => field.field.name === "input_images");
    expect(list?.field.kind).toBe("ref-list");
    expect(list?.handleAvailable).toBe(false);
    expect(list?.capacity).toBeUndefined();
  });

  test("exposes capability capacity for a supported multi-image model", () => {
    const node = dataFor({
      stepType: "image",
      config: { prompt: "fuse", input_images: [{ step: "gen", output: "generated_image" }], model: "gemini-3-pro-image", aspect_ratio: "1:1", brand_guidelines: false },
    });
    const fields = buildInspectorRefFields(node, steps, { "gemini-3-pro-image": { multiImageInput: true, maxImageInputs: 14 } });
    const list = fields.find((field) => field.field.name === "input_images");
    expect(list?.handleAvailable).toBe(true);
    expect(list?.capacity).toBe(14);
  });

  test("surfaces a BackendInputRef object in a text/textarea field as a connection summary (no [object Object])", () => {
    // A literal-or-ref prompt slot holding a resolved {step,output} object is the
    // value that would render as "[object Object]"; the composition layer must
    // still surface it for the inspector's disconnect summary.
    const captioned: WorkflowStep[] = [
      ...steps,
      { id: "cap", type: "text", label: "Caption", inputs: [{ mode: "fixed" }], config: { prompt: "c", model: "gemini-3-flash-preview" } },
    ];
    const node = dataFor({
      config: { input_images: "", prompt: { step: "cap", output: "generated_text" }, model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false },
    });
    const fields = buildInspectorRefFields(node, captioned, {});
    const prompt = fields.find((field) => field.field.name === "prompt");
    expect(prompt?.field.kind).toBe("textarea");
    expect(prompt?.connections).toHaveLength(1);
    expect(prompt?.connections[0]?.ref).toEqual({ step: "cap", output: "generated_text" });
    expect(prompt?.connections[0]?.sourceLabel).toBe("Caption");
  });

  test("does not surface a plain literal string prompt as a connection", () => {
    // acceptsRef prompt fields are always collected, but a plain literal string
    // yields no connection (no chip / nothing to disconnect).
    const node = dataFor({ config: { input_images: [], prompt: "sharpen", model: "gemini-2.5-flash-image", aspect_ratio: "1:1", brand_guidelines: false } });
    const fields = buildInspectorRefFields(node, steps, {});
    const prompt = fields.find((field) => field.field.name === "prompt");
    expect(prompt?.connections).toEqual([]);
  });

  test("an acceptsRef prompt field surfaces its whole-value ref for disconnect (string form)", () => {
    // audio.prompt is declared acceptsRef; a whole-value "step::output" reference
    // is resolved into a connection summary so the inspector can render/disconnect it.
    const captioned: WorkflowStep[] = [
      ...steps,
      { id: "cap", type: "text", label: "Caption", inputs: [{ mode: "fixed" }], config: { prompt: "c", model: "gemini-3-flash-preview" } },
    ];
    const node: WorkflowCanvasNodeData = {
      stepId: "aud",
      stepType: "audio",
      label: "Audio",
      config: { prompt: "cap::generated_audio", model: "lyria-002" },
      validation: [],
      order: 3,
    };
    const fields = buildInspectorRefFields(node, captioned, {});
    const prompt = fields.find((field) => field.field.name === "prompt");
    expect(prompt?.field.acceptsRef).toBe(true);
    expect(prompt?.connections).toHaveLength(1);
    expect(prompt?.connections[0]?.ref).toEqual({ step: "cap", output: "generated_audio" });
    expect(prompt?.connections[0]?.sourceLabel).toBe("Caption");
  });
});

describe("classifyNavigationTarget (dirty-navigation guard classification)", () => {
  const here = { pathname: "/workflows/abc/edit", origin: "https://app.example.com" };

  test("same-pathname query-only link is internal (never blocked)", () => {
    expect(classifyNavigationTarget(here, "?workspace=x")).toBe("internal");
  });

  test("hash-only link is internal", () => {
    expect(classifyNavigationTarget(here, "#workflow-canvas-main")).toBe("internal");
  });

  test("same-origin different pathname leaves the editor", () => {
    expect(classifyNavigationTarget(here, "/workflows")).toBe("leaves-editor");
    expect(classifyNavigationTarget(here, "/images")).toBe("leaves-editor");
  });

  test("relative href resolving to a different pathname leaves the editor", () => {
    // Resolved against the directory of /workflows/abc/edit -> /workflows/abc/new-edit.
    expect(classifyNavigationTarget({ pathname: "/workflows/abc/edit", origin: "https://app.example.com" }, "new-edit")).toBe("leaves-editor");
  });

  test("cross-origin link is external", () => {
    expect(classifyNavigationTarget(here, "https://other.example.com/workflows")).toBe("external");
  });

  test("empty href is internal", () => {
    expect(classifyNavigationTarget(here, "")).toBe("internal");
  });
});

describe("TOOLBAR_WRAPPER_CLASS (WorkspaceSwitcher overlap guard)", () => {
  // The floating WorkspaceSwitcher pill (max ~17rem / 272px, rooted at left
  // 5vw md / 3vw xl) sits above the canvas (z-101). In the overlay layout the
  // canvas spans the full viewport and the toolbar floats over its top edge, so
  // only the toolbar needs a left clearance: this wrapper pushes toolbar content
  // to the pill's right edge = (5vw|3vw) + 17rem on md/xl ONLY; mobile is
  // untouched (the pill docks bottom-left there). The floating palette reuses
  // the same clearance for its own left anchor (see the editor shell).
  test("adds md/xl left clearance so the toolbar clears the 17rem pill", () => {
    expect(TOOLBAR_WRAPPER_CLASS).toContain("md:pl-[320px]");
    expect(TOOLBAR_WRAPPER_CLASS).toContain("xl:pl-[320px]");
  });

  test("does not inset mobile (no base / max-md left padding)", () => {
    const tokens = TOOLBAR_WRAPPER_CLASS.split(/\s+/);
    const plTokens = tokens.filter((token) => token.includes("pl-"));
    expect(plTokens.length).toBeGreaterThan(0);
    // every pl- token is desktop-only (md:/xl:), so <md is never inset
    expect(plTokens.every((token) => token.startsWith("md:") || token.startsWith("xl:"))).toBe(true);
    expect(tokens.some((token) => token.startsWith("pl-"))).toBe(false);
    expect(TOOLBAR_WRAPPER_CLASS).not.toContain("max-md:");
  });

  test("keeps the toolbar bar full-width (own border/bg) so the header seam is hidden", () => {
    expect(TOOLBAR_WRAPPER_CLASS).toContain("border-b");
    expect(TOOLBAR_WRAPPER_CLASS).toContain("bg-[var(--tri-bg-surface)]");
    // The header's inset border is neutralized; the wrapper owns the full-width rule.
    expect(TOOLBAR_WRAPPER_CLASS).toContain("[&>header]:border-b-0");
  });
});

describe("fieldAcceptsRef (literal-or-ref detection)", () => {
  // `StepFieldSpec` gains `acceptsRef` in the dynamic-connection workstream; the
  // helper reads it defensively, so cast synthetic specs here.
  const spec = (over: Partial<StepFieldSpec> & { kind: StepFieldSpec["kind"] }): StepFieldSpec =>
    ({ name: "prompt", label: "Prompt", bucket: "inputs", default: "", ...over }) as StepFieldSpec;

  test("true for text/textarea fields marked acceptsRef", () => {
    expect(fieldAcceptsRef(spec({ kind: "textarea", acceptsRef: true }))).toBe(true);
    expect(fieldAcceptsRef(spec({ kind: "text", acceptsRef: true }))).toBe(true);
  });

  test("false without acceptsRef, and for non-text kinds even when acceptsRef is set", () => {
    expect(fieldAcceptsRef(spec({ kind: "textarea" }))).toBe(false);
    expect(fieldAcceptsRef(spec({ kind: "select", acceptsRef: true }))).toBe(false);
    expect(fieldAcceptsRef(spec({ kind: "ref", acceptsRef: true }))).toBe(false);
    expect(fieldAcceptsRef(spec({ kind: "ref-list", acceptsRef: true }))).toBe(false);
  });
});

describe("findDisconnectEdge (onDisconnectRef -> dynamic edge wiring)", () => {
  const edges: WorkflowCanvasEdge[] = [
    { id: "e1", source: "cap", target: "ed", sourceHandle: "generated_text", targetHandle: "prompt", refType: "text", cardinality: "scalar" },
    { id: "e2", source: "gen", target: "ed", sourceHandle: "generated_image", targetHandle: "input_images", refType: "image", cardinality: "list" },
  ];

  test("returns the edge materializing one connection on a target field", () => {
    expect(findDisconnectEdge(edges, "ed", "prompt", { step: "cap", output: "generated_text" })?.id).toBe("e1");
    expect(findDisconnectEdge(edges, "ed", "input_images", { step: "gen", output: "generated_image" })?.id).toBe("e2");
  });

  test("returns undefined when source, output, field, or target mismatch", () => {
    expect(findDisconnectEdge(edges, "ed", "prompt", { step: "cap", output: "other" })).toBeUndefined();
    expect(findDisconnectEdge(edges, "ed", "prompt", { step: "gen", output: "generated_text" })).toBeUndefined();
    expect(findDisconnectEdge(edges, "ed", "missing", { step: "cap", output: "generated_text" })).toBeUndefined();
    expect(findDisconnectEdge(edges, "other", "prompt", { step: "cap", output: "generated_text" })).toBeUndefined();
  });
});

describe("SKIP_TO_CANVAS_LINK_CLASS (studio chrome occlusion guard)", () => {
  // The skip link used to dock at top-left (`left: space-3`), directly under the
  // floating WorkspaceSwitcher pill (rooted at left 5vw md / 3vw xl, ~17rem wide,
  // z-101). On focus it must appear past the pill's right edge = 320px,
  // matching the toolbar's own clearance (TOOLBAR_WRAPPER_CLASS). Mobile keeps
  // the default because the pill docks bottom-left <md.
  test("mobile (<md) keeps the default top-left position (no max-md override)", () => {
    expect(SKIP_TO_CANVAS_LINK_CLASS).toContain("focus:left-[var(--tri-space-3)]");
    expect(SKIP_TO_CANVAS_LINK_CLASS).not.toContain("max-md:");
  });

  test("md/xl move into the toolbar-cleared area past the 320px clearance", () => {
    expect(SKIP_TO_CANVAS_LINK_CLASS).toContain("md:focus:left-[320px]");
    expect(SKIP_TO_CANVAS_LINK_CLASS).toContain("xl:focus:left-[320px]");
  });
});
