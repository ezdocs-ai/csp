/** Copyright 2026 Google LLC — Apache-2.0 */
export type { InputMode, InputParam, InputParamType, StepType, WorkflowDefinition, WorkflowDraft, WorkflowStep } from "./types";
export {
  STEP_ID_PATTERN,
  cascadeParamRename,
  ensureSingleUserInputStep,
  generateStepId,
  isIdentifierSafe,
  normalizeParamOutputName,
  normalizeWorkflowIdentifiers,
  toSafeIdentifier,
} from "./hooks/identifiers";
export { MODEL_IMAGE_INPUT_CAPABILITIES, isModelGatedRefList, maxImageInputsForModel, modelSupportsImageReferences, parseRefItem, parseRefList, refListVisibleFor } from "./hooks/step-configs";
export type { RefListCapability } from "./hooks/step-configs";
