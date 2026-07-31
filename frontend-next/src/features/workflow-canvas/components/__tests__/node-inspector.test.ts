/** Copyright 2026 Google LLC — Apache-2.0 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";

import { capacityLabel, fieldDisplayName, formatRefSummary, inspectorTypeLabel, isBackendInputRefValue, isVirtualInputNode, NodeInspector, splitInspectorFields } from "../node-inspector";
import type { WorkflowCanvasNodeData } from "../../graph-types";
import { STEP_FIELDS, type BackendInputRef, type StepFieldSpec } from "@/src/features/workflow-editor/hooks/step-configs";

const imageNode: WorkflowCanvasNodeData = {
  stepId: "image_1",
  stepType: "image",
  label: "Hero",
  config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false },
  validation: [],
  order: 2,
};

test("formatRefSummary prefers the human source label", () => {
  expect(formatRefSummary({ step: "s1", output: "generated_image" }, "Source image")).toBe("Source image · generated_image");
  expect(formatRefSummary({ step: "s1", output: "generated_image" }, "")).toBe("s1::generated_image");
});

test("capacityLabel: undefined capacity shows count only", () => {
  expect(capacityLabel(2, undefined)).toBe("2");
  expect(capacityLabel(2, 4)).toBe("2 / 4");
});

test("fieldDisplayName marks required fields", () => {
  expect(fieldDisplayName({ name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "", required: true })).toBe("Prompt *");
  expect(fieldDisplayName({ name: "model", label: "Model", bucket: "settings", kind: "text", default: "m" })).toBe("Model");
});

test("splitInspectorFields separates image config from ref-list input_images", () => {
  const { config, refs } = splitInspectorFields(imageNode);
  expect(refs.map((f) => f.name)).toEqual(["input_images"]);
  expect(refs[0]?.kind).toBe("ref-list");
  expect(config.map((f) => f.name)).toEqual(["prompt", "model", "aspect_ratio", "brand_guidelines"]);
});

test("splitInspectorFields: vto has only refs and no scalar config", () => {
  const vto: WorkflowCanvasNodeData = { stepId: "vto_1", stepType: "vto", label: "VTO", config: {}, validation: [], order: 3 };
  const { config, refs } = splitInspectorFields(vto);
  expect(config).toEqual([]);
  expect(refs.map((f) => f.name)).toEqual(["model_image", "top_image", "bottom_image", "dress_image", "shoes_image"]);
});

test("splitInspectorFields: user-input has no config and no refs", () => {
  const user: WorkflowCanvasNodeData = { stepId: "user_input_1", stepType: "user-input", label: "Args", config: {}, validation: [], order: 1 };
  expect(splitInspectorFields(user)).toEqual({ config: [], refs: [] });
});

test("inspector delete button renders a single accessible delete action with no local confirm", () => {
  // The inspector must own NO confirm of its own — the canvas editor's single
  // top-level force-delete ConfirmDialog is the only destructive confirm (a node
  // with no downstream refs deletes directly via the editor guard). Bun has no
  // DOM, so SSR-render the inspector and assert the contract: the danger delete
  // button is present and named after the node, the 44px target token is on it,
  // and the old inspector-local confirm copy/title are gone (no double-prompt).
  const html = renderToStaticMarkup(
    createElement(NodeInspector, {
      node: imageNode,
      refFields: [],
      onUpdateLabel: () => {},
      onUpdateConfig: () => {},
      onUpdateInputParams: () => {},
      onDisconnectRef: () => {},
      onDelete: () => {},
      validation: [],
    }),
  );
  expect(html).toContain("Delete Hero");
  // 44px touch target comes from the shared Button's height token.
  expect(html).toContain("min-h-[var(--tri-button-height)]");
  // No inspector-local confirm dialog is emitted.
  expect(html).not.toContain("Confirm delete");
  expect(html).not.toContain("Delete Hero?");
});

const promptSpec = STEP_FIELDS["image"].find((f) => f.name === "prompt") as StepFieldSpec;
const promptRef: BackendInputRef = { step: "text_1", output: "generated_text" };

/** image node whose `prompt` (textarea) currently carries a resolved BackendInputRef
 *  object — the value that previously rendered as "[object Object]". */
const linkedPromptNode: WorkflowCanvasNodeData = {
  ...imageNode,
  config: { ...imageNode.config, prompt: { ...promptRef } },
};

test("isBackendInputRefValue guards the object ref form only", () => {
  expect(isBackendInputRefValue({ step: "s", output: "o" })).toBe(true);
  expect(isBackendInputRefValue("s::o")).toBe(false);
  expect(isBackendInputRefValue(3)).toBe(false);
  expect(isBackendInputRefValue([{ step: "s", output: "o" }])).toBe(false);
  expect(isBackendInputRefValue({ step: "s" })).toBe(false);
  expect(isBackendInputRefValue(null)).toBe(false);
});

test("a text/textarea field holding a BackendInputRef renders a linked-source chip, never [object Object]", () => {
  const html = renderToStaticMarkup(
    createElement(NodeInspector, {
      node: linkedPromptNode,
      refFields: [
        {
          field: promptSpec,
          connections: [{ field: "prompt", ref: promptRef, sourceLabel: "Caption" }],
          handleAvailable: true,
        },
      ],
      onUpdateLabel: () => {},
      onUpdateConfig: () => {},
      onUpdateInputParams: () => {},
      onDisconnectRef: () => {},
      onDelete: () => {},
      validation: [],
    }),
  );
  // The resolved object must never leak as "[object Object]".
  expect(html).not.toContain("[object Object]");
  // The linked-source summary (source label · output) is shown instead.
  expect(html).toContain("Caption \u00b7 generated_text");
  // Explicit Disconnect + Use literal value actions are present and accessible.
  expect(html).toContain("Disconnect");
  expect(html).toContain("Use literal value");
  expect(html).toContain("Disconnect Caption \u00b7 generated_text from Prompt");
});

test("a literal-or-ref field with a plain string value stays an editable literal (typing supported)", () => {
  // After "Use literal value" clears the ref, the same field re-renders as a plain
  // textarea seeded with the literal text — no chip, no Disconnect action.
  const html = renderToStaticMarkup(
    createElement(NodeInspector, {
      node: imageNode,
      refFields: [],
      onUpdateLabel: () => {},
      onUpdateConfig: () => {},
      onUpdateInputParams: () => {},
      onDisconnectRef: () => {},
      onDelete: () => {},
      validation: [],
    }),
  );
  expect(html).toContain("<textarea");
  expect(html).toContain(">p</textarea>");
  expect(html).not.toContain("Use literal value");
});

test("a textarea literal-or-ref field stays in the Configuration section, not Connections", () => {
  // splitInspectorFields keeps text/textarea fields in `config` so the
  // literal-or-ref prompt renders in the normal configuration section; only
  // declared ref/ref-list fields move to Connections.
  const { config, refs } = splitInspectorFields(imageNode);
  expect(config.map((f) => f.name)).toContain("prompt");
  expect(refs.map((f) => f.name)).not.toContain("prompt");
});

/* ----------------------------- v2 virtual inputs ----------------------------- */

const textInputNode: WorkflowCanvasNodeData = {
  stepId: "user_input_1",
  stepType: "user-input",
  label: "Caption",
  config: {},
  inputParams: [{ name: "Caption", type: "text" }],
  validation: [],
  order: null,
  canvasKind: "text-input",
};

const imageInputNode: WorkflowCanvasNodeData = {
  ...textInputNode,
  label: "Photo",
  inputParams: [{ name: "Photo", type: "image" }],
  canvasKind: "image-input",
};

const ingredientsNode: WorkflowCanvasNodeData = {
  stepId: "image_1",
  stepType: "image",
  label: "Composite",
  config: { prompt: "p", model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false },
  validation: [],
  order: 2,
  canvasKind: "ingredients-image",
};

function renderInspector(node: WorkflowCanvasNodeData | null) {
  return renderToStaticMarkup(
    createElement(NodeInspector, {
      node,
      refFields: [],
      onUpdateLabel: () => {},
      onUpdateConfig: () => {},
      onUpdateInputParams: () => {},
      onDisconnectRef: () => {},
      onDelete: () => {},
      validation: [],
    }),
  );
}

test("isVirtualInputNode detects only the projected text/image inputs", () => {
  expect(isVirtualInputNode(textInputNode)).toBe(true);
  expect(isVirtualInputNode(imageInputNode)).toBe(true);
  expect(isVirtualInputNode(ingredientsNode)).toBe(false);
  expect(isVirtualInputNode(imageNode)).toBe(false);
});

test("inspectorTypeLabel distinguishes Ingredients while keeping the ordinary stepType", () => {
  expect(inspectorTypeLabel(ingredientsNode)).toBe("Ingredients to image");
  expect(inspectorTypeLabel(imageNode)).toBe("image");
});

test("virtual input inspector never shows the multi-parameter Add parameter UI", () => {
  const html = renderInspector(imageInputNode);
  expect(html).not.toContain("Add parameter");
  expect(html).not.toContain("Run-time parameters");
  // independent properties only: no Configuration/Connections sections.
  expect(html).not.toContain("Configuration");
  expect(html).not.toContain("Connections");
});

test("virtual input inspector renders name + type editors and the one output summary", () => {
  const html = renderInspector(imageInputNode);
  expect(html).toContain("Name");
  expect(html).toContain("Input type");
  expect(html).toContain("<select");
  // name editor seeded with the projected param name.
  expect(html).toContain("value=\"Photo\"");
  // one output summary: the single projected param output id + image type.
  expect(html).toContain("photo");
  expect(html).toContain("image");
});

test("virtual input inspector delete action is named after the node", () => {
  const html = renderInspector(imageInputNode);
  expect(html).toContain("Delete Photo");
});

test("text input inspector shows a text output summary", () => {
  const html = renderInspector(textInputNode);
  expect(html).toContain("caption");
  expect(html).toContain("text");
});

test("Ingredients node inspector: distinct identity but normal config sections unchanged", () => {
  const html = renderInspector(ingredientsNode);
  expect(html).toContain("Ingredients to image");
  expect(html).toContain("Configuration");
  expect(html).toContain("Connections");
  // ingredients is executable: the order badge is present.
  expect(html).toContain("#2");
  expect(html).toContain("Delete Composite");
});
