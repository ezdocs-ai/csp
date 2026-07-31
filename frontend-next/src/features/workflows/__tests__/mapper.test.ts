/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { workflowModelToUi, workflowSearchToUi } from "../mapper";
import type { WorkflowModelDto, WorkflowSearchResponseDto } from "../types";

const model: WorkflowModelDto = {
  id: "wf-1",
  name: "N",
  description: null,
  steps: [{ stepId: "s1", type: "generate_image", inputs: {}, settings: {}, outputs: {} }],
  userId: 42,
};

test("workflowModelToUi maps steps into definition.steps (preserves component API) and null description -> undefined", () => {
  const ui = workflowModelToUi(model);
  expect(ui.id).toBe("wf-1");
  expect(ui.description).toBeUndefined();
  expect(ui.definition).toEqual({ steps: model.steps });
});

test("workflowSearchToUi flattens the paginated data array", () => {
  const response: WorkflowSearchResponseDto = {
    data: [model],
    count: 1,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  };
  const ui = workflowSearchToUi(response);
  expect(ui).toHaveLength(1);
  expect((ui[0].definition as { steps: unknown[] }).steps).toEqual(model.steps);
});
