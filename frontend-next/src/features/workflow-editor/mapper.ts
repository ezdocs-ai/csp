/** Copyright 2026 Google LLC — Apache-2.0 */
import type {
  BackendWorkflowStep,
  NodeType,
  StepType,
  WorkflowCreateDto,
  WorkflowDraft,
  WorkflowStep,
  WorkflowUpdateDto,
} from "./types";
import { buildBackendStepConfig } from "./hooks/step-configs";
import { paramsToOutputs } from "./hooks/transforms";

/** UI short step type -> backend NodeTypes discriminator. */
const NODE_TYPE: Record<StepType, NodeType> = {
  "user-input": "user_input",
  text: "generate_text",
  image: "generate_image",
  edit: "edit_image",
  video: "generate_video",
  vto: "virtual_try_on",
  audio: "generate_audio",
};

export function stepTypeToNodeType(short: StepType): NodeType | null {
  return NODE_TYPE[short] ?? null;
}

/** Backend NodeTypes discriminator -> UI short step type (inverse of stepTypeToNodeType). */
export function nodeTypeToStepType(node: NodeType): StepType | null {
  const entry = (Object.entries(NODE_TYPE) as [StepType, NodeType][]).find(([, value]) => value === node);
  return entry ? entry[0] : null;
}

/**
 * UI step -> backend step. Enriches inputs/settings from the per-type config
 * captured in the editor (hooks/step-configs) so the strict backend DTO validates.
 */
export function toBackendStep(step: WorkflowStep): BackendWorkflowStep | null {
  const type = stepTypeToNodeType(step.type);
  if (!type) return null;
  const { inputs, settings } = buildBackendStepConfig(step.type, step.config ?? {});
  // user_input run-time parameters live in `outputs` ({ name: { type } }); the backend forbids
  // extra inputs/settings keys and reads step.outputs to build workflow args. Other steps emit {}.
  const outputs = step.type === "user-input" ? paramsToOutputs(step.inputParams ?? []) : {};
  return { stepId: step.id, type, inputs, settings, outputs };
}

function stepsFromDraft(draft: WorkflowDraft): BackendWorkflowStep[] {
  return (draft.definition?.steps ?? [])
    .map(toBackendStep)
    .filter((step): step is BackendWorkflowStep => step !== null);
}

/** UI draft -> backend WorkflowCreateDto (strips the `definition` wrapper, maps discriminators). */
export function workflowDraftToCreateDto(draft: WorkflowDraft): WorkflowCreateDto {
  return { name: draft.name, description: draft.description ?? null, steps: stepsFromDraft(draft) };
}

export function workflowDraftToUpdateDto(draft: WorkflowDraft): WorkflowUpdateDto {
  return workflowDraftToCreateDto(draft);
}
