/** Copyright 2026 Google LLC — Apache-2.0
 * Public surface of the workflow-canvas graph core. UI components (Phase 2+)
 * consume this barrel; nothing here imports React Flow at runtime — the types
 * are structurally compatible so the future UI layer adopts them as-is.
 *
 * See Serena memory `migration_nextjs/workflow_canvas_reactflow/plan` §5. */
export type {
  CanvasAddKind,
  CanvasConnection,
  ConfigPatch,
  ModelCapability,
  ModelCapabilityMap,
  SavedLayout,
  SavedNodeLayout,
  Viewport,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowCanvasNodeData,
  XYPosition,
  ConnectionValidation,
  ValidationResult,
} from "./graph-types";

export {
  STEP_FIELDS,
  buildModelCapabilityMap,
  connectionToConfigPatch,
  deterministicLayout,
  edgeId,
  isLiteralOrRefField,
  isRefListField,
  isScalarRefField,
  literalOrRefValueOf,
  outputSpecsFor,
  refListValueOf,
  refsForField,
  removeEdgeToConfigPatch,
  scalarRefValueOf,
  stepsToEdges,
  stepsToNodes,
} from "./adapters/graph-adapter";

export type {
  ImageCanvasVariant,
  VirtualInputDescriptor,
  VirtualInputKind,
} from "./adapters/virtual-inputs";
export {
  VIRTUAL_INPUT_DELIMITER,
  clearSingletonOutputRef,
  clearSingletonOutputRefFromConfig,
  clearSingletonOutputRefFromStep,
  clearSingletonOutputRefFromWorkflow,
  expandVirtualInputs,
  inferIngredientsVariant,
  isVirtualInputId,
  parseVirtualInputId,
  sourceToVirtualId,
  virtualIdToBackendRef,
  virtualInputId,
} from "./adapters/virtual-inputs";

export type { ExecutionOrderResult } from "./adapters/graph-validation";
export {
  hasCycle,
  isIdentifierSafe,
  reorderStepsTopologically,
  validateConnection,
  validateExecutionOrder,
  validateWorkflow,
} from "./adapters/graph-validation";

export {
  LAYOUT_STORAGE_VERSION,
  clearSavedLayout,
  layoutHash,
  readSavedLayout,
  writeSavedLayout,
} from "./hooks/use-canvas-layout-storage";
export type {
  CanvasLayoutStorage,
  LayoutPositionEntry,
} from "./hooks/use-canvas-layout-storage";

export { WorkflowCanvasEditor } from "./components/workflow-canvas-editor";
export type { WorkflowCanvasEditorProps } from "./components/workflow-canvas-editor";
export {
  addVirtualInputParam,
  applyConfigPatchToStep,
  buildRunDefinition,
  computeParamRename,
  dependentStepIds,
  dependentStepIdsForOutput,
  fieldForConnection,
  ingredientsValidation,
  logConnectionEvent,
  makeNewStep,
  reconcileNodes,
  removeStepAndDownstreamRefs,
  removeVirtualInputParam,
  serializeDraftForDirty,
  uniqueParamName,
} from "./hooks/use-workflow-canvas";
export type { CanvasNode, UseWorkflowCanvasReturn } from "./hooks/use-workflow-canvas";
export { useWorkflowCanvas } from "./hooks/use-workflow-canvas";
export { useCanvasLayoutStorage } from "./hooks/use-canvas-layout-storage";
