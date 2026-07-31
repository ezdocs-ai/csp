/** Copyright 2026 Google LLC — Apache-2.0 */
import type { Workflow, WorkflowModelDto, WorkflowSearchResponseDto } from "./types";

/**
 * Backend WorkflowModel -> UI Workflow. Preserves the `definition.steps` shape that
 * existing list/detail/run components read (e.g. run-workflow-modal inputFields).
 * description null -> undefined to satisfy the optional UI field.
 */
export function workflowModelToUi(model: WorkflowModelDto): Workflow {
  return {
    id: model.id,
    name: model.name,
    description: model.description ?? undefined,
    definition: { steps: model.steps },
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

export function workflowSearchToUi(response: WorkflowSearchResponseDto): Workflow[] {
  return (response.data ?? []).map(workflowModelToUi);
}
