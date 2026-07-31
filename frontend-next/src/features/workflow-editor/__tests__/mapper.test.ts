/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import {
  nodeTypeToStepType,
  stepTypeToNodeType,
  toBackendStep,
  workflowDraftToCreateDto,
  workflowDraftToUpdateDto,
} from "../mapper";
import type { WorkflowDraft } from "../types";

const draft: WorkflowDraft = {
  name: "Draft",
  description: "desc",
  definition: {
    steps: [
      { id: "s1", type: "image", label: "Img", inputs: [{ mode: "fixed" }] },
      { id: "s2", type: "vto", label: "VTO", inputs: [{ mode: "linked", sourceStepId: "s1" }] },
    ],
  },
};

test("stepTypeToNodeType maps every UI short type to the backend NodeTypes discriminator", () => {
  expect(stepTypeToNodeType("user-input")).toBe("user_input");
  expect(stepTypeToNodeType("text")).toBe("generate_text");
  expect(stepTypeToNodeType("image")).toBe("generate_image");
  expect(stepTypeToNodeType("edit")).toBe("edit_image");
  expect(stepTypeToNodeType("video")).toBe("generate_video");
  expect(stepTypeToNodeType("vto")).toBe("virtual_try_on");
  expect(stepTypeToNodeType("audio")).toBe("generate_audio");
});

test("toBackendStep enriches inputs/settings from step.config and drops UI-only label", () => {
  const step = toBackendStep({ id: "s1", type: "image", label: "Img", inputs: [{ mode: "fixed" }] });
  expect(step).toEqual({
    stepId: "s1",
    type: "generate_image",
    inputs: { prompt: "" },
    settings: { model: "gemini-3.1-flash-image", aspect_ratio: "1:1", brand_guidelines: false },
    outputs: {},
  });
  expect(step).not.toHaveProperty("label");
});

test("toBackendStep passes captured config values through to inputs/settings", () => {
  const step = toBackendStep({
    id: "s1",
    type: "image",
    label: "Img",
    inputs: [{ mode: "fixed" }],
    config: { prompt: "a cat", model: "gemini-3.1-flash-image", aspect_ratio: "16:9", brand_guidelines: true },
  });
  expect(step).toEqual({
    stepId: "s1",
    type: "generate_image",
    inputs: { prompt: "a cat" },
    settings: { model: "gemini-3.1-flash-image", aspect_ratio: "16:9", brand_guidelines: true },
    outputs: {},
  });
});

test("nodeTypeToStepType is the inverse of stepTypeToNodeType", () => {
  expect(nodeTypeToStepType("generate_image")).toBe("image");
  expect(nodeTypeToStepType("virtual_try_on")).toBe("vto");
  expect(nodeTypeToStepType("user_input")).toBe("user-input");
});

test("workflowDraftToCreateDto strips the definition wrapper and enriches each step", () => {
  const dto = workflowDraftToCreateDto(draft);
  expect(dto.name).toBe("Draft");
  expect(dto.description).toBe("desc");
  expect(dto).not.toHaveProperty("definition");
  expect(dto.steps[0]).toMatchObject({ stepId: "s1", type: "generate_image" });
  expect(dto.steps[0].settings).toHaveProperty("model");
  expect(dto.steps[1]).toMatchObject({ stepId: "s2", type: "virtual_try_on" });
});

test("workflowDraftToCreateDto coerces missing description to null (DTO allows string|null)", () => {
  const dto = workflowDraftToCreateDto({ name: "N", definition: { steps: [] } });
  expect(dto.description).toBeNull();
  expect(dto.steps).toEqual([]);
});

test("update DTO has the same shape as create", () => {
  expect(workflowDraftToUpdateDto(draft)).toEqual(workflowDraftToCreateDto(draft));
});

test("toBackendStep serializes user_input inputParams into step.outputs ({ name: { type } })", () => {
  const step = toBackendStep({
    id: "ui",
    type: "user-input",
    label: "User input",
    inputs: [{ mode: "fixed" }],
    inputParams: [{ name: "Prompt", type: "text" }, { name: "User Image", type: "image" }],
  });
  expect(step).toEqual({
    stepId: "ui",
    type: "user_input",
    inputs: {},
    settings: {},
    outputs: { prompt: { type: "text" }, user_image: { type: "image" } },
  });
});

test("toBackendStep user_input with no params emits empty outputs", () => {
  const step = toBackendStep({ id: "ui", type: "user-input", label: "UI", inputs: [{ mode: "fixed" }] });
  expect((step as { outputs: unknown }).outputs).toEqual({});
});
