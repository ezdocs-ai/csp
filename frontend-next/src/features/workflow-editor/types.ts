/** Copyright 2026 Google LLC — Apache-2.0 */
export type StepType = "user-input" | "text" | "image" | "edit" | "video" | "vto" | "audio";
export type InputMode = "fixed" | "linked" | "mixed";

/** User-defined run-time parameter on a user_input step. Mirrors the Angular editor's
 * dynamic output definitions; serialized to the backend user_input step `outputs` map
 * (backend forbids extra `inputs`, and yaml-gen reads step.outputs for workflow params). */
export type InputParamType = "text" | "image";
export type InputParam = { name: string; type: InputParamType };

export type WorkflowStep = {
  id: string;
  type: StepType;
  label: string;
  inputs: { mode: InputMode; value?: string; sourceStepId?: string }[];
  outputRef?: string;
  /** Per-step-type captured inputs/settings, mirrored from hooks/step-configs.
   * Values may be scalars or a StepOutputReferenceDto (refs round-tripped from backend). */
  config?: Record<string, string | number | boolean | StepOutputReferenceDto | StepOutputReferenceDto[]>;
  /** user_input only — the run-time parameters this workflow collects. */
  inputParams?: InputParam[];
};
export type WorkflowDefinition = { steps: WorkflowStep[] };
export type WorkflowDraft = { id?: string; name: string; description?: string; definition: WorkflowDefinition };

/*
 * Backend contract — WorkflowCreateDto / WorkflowModel steps[] oneOf, discriminated by `type`.
 * Source of truth: backend OpenAPI (NodeTypes enum). UI step types above are preserved so the
 * existing editor hooks keep compiling; mappers translate UI <-> backend.
 * Per-type inputs/settings (prompt, model, aspect_ratio, ...) are open objects here;
 * per-field validation/coercion lives in hooks/step-configs (STEP_FIELDS), not the type.
 */
export type NodeType =
  | "user_input"
  | "generate_text"
  | "generate_image"
  | "edit_image"
  | "generate_video"
  | "virtual_try_on"
  | "generate_audio";

export type StepStatusDto = "idle" | "pending" | "running" | "completed" | "failed" | "skipped";

export type StepOutputReferenceDto = { step: string; output: string };

type BackendStepBase = {
  stepId: string;
  status?: StepStatusDto;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  outputs?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

export type UserInputStepDto = BackendStepBase & { type: "user_input" };
export type GenerateTextStepDto = BackendStepBase & { type: "generate_text" };
export type GenerateImageStepDto = BackendStepBase & { type: "generate_image" };
export type EditImageStepDto = BackendStepBase & { type: "edit_image" };
export type GenerateVideoStepDto = BackendStepBase & { type: "generate_video" };
export type VirtualTryOnStepDto = BackendStepBase & { type: "virtual_try_on" };
export type GenerateAudioStepDto = BackendStepBase & { type: "generate_audio" };

export type BackendWorkflowStep =
  | UserInputStepDto
  | GenerateTextStepDto
  | GenerateImageStepDto
  | EditImageStepDto
  | GenerateVideoStepDto
  | VirtualTryOnStepDto
  | GenerateAudioStepDto;

export type WorkflowCreateDto = { name: string; description?: string | null; steps: BackendWorkflowStep[] };
export type WorkflowUpdateDto = WorkflowCreateDto;
