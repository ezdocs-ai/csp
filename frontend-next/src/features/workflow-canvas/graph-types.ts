/** Copyright 2026 Google LLC — Apache-2.0
 * Pure graph-core types for the workflow canvas. Deliberately independent of
 * `@xyflow/react` (not yet installed): the shapes are structurally compatible
 * with React Flow's Node/Edge surface so the future UI layer can adopt them
 * without remapping. Backend step config refs are the single source of truth;
 * React Flow position/viewport/selected/style NEVER flow into these types.
 *
 * See Serena memory `migration_nextjs/workflow_canvas_reactflow/plan` §7–§9. */
import type {
  BackendInputRef,
  ConfigValues,
  RefType,
} from "../workflow-editor/hooks/step-configs";
import type { InputParam, StepType } from "../workflow-editor/types";

export type XYPosition = { x: number; y: number };
export type Viewport = { x: number; y: number; zoom: number };

/** Canvas-only node variant (view metadata, never serialized into the backend
 * step DTO). Distinguishes the virtual independent input nodes projected from
 * the hidden singleton `user_input` step and the Ingredients-to-Image render of a
 * `generate_image` step. See Serena memory
 * `migration_nextjs/workflow_canvas_reactflow/v2_independent_input_nodes`. */
export type CanvasKind = "text-input" | "image-input" | "ingredients-image";

/** Palette add kinds accepted by `useWorkflowCanvas.addNode`: every supported
 *  backend executor step type EXCEPT the hidden singleton `user-input`, plus the
 *  three canvas-only virtual add kinds. `text-input`/`image-input` append a unique
 *  parameter to the hidden singleton (projected as an independent virtual node);
 *  `ingredients-image` creates an ordinary `image` backend step plus a canvas-only
 *  Ingredients variant marker. None is ever serialized as a distinct backend
 *  discriminator. See Serena memory
 *  `migration_nextjs/workflow_canvas_reactflow/v2_independent_input_nodes`. */
export type CanvasAddKind = Exclude<StepType, "user-input"> | CanvasKind;

/** Data payload for one canvas node. `validation`/`order`/`canvasKind` are derived
 * at read time and never serialized into the backend step DTO. */
export type WorkflowCanvasNodeData = {
  stepId: string;
  stepType: StepType;
  label: string;
  config: ConfigValues;
  inputParams?: InputParam[];
  /** Live validation messages for this node (computed by graph-validation). */
  validation: string[];
  /** Backend execution ordinal (1-based) so the linear backend order is visible.
   *  `null` hides the order badge on non-executable virtual input nodes projected
   *  from the hidden singleton; the hidden singleton itself is never a node, so the
   *  visible executable order excludes it. */
  order: number | null;
  /** Canvas-only node variant; `undefined` for ordinary one-node-per-step nodes. */
  canvasKind?: CanvasKind;
};

/** Minimal Node shape (RF-compatible). `id === WorkflowStep.id === backend stepId`. */
export type WorkflowCanvasNode = {
  id: string;
  type: StepType;
  position: XYPosition;
  data: WorkflowCanvasNodeData;
};

/** Minimal Edge shape (RF-compatible). One edge per resolved config ref. */
export type WorkflowCanvasEdge = {
  /** Stable: `${source}::${sourceHandle}__${target}::${targetHandle}`. */
  id: string;
  source: string;
  target: string;
  /** Source output name (e.g. `generated_image`, or a user-input param id). */
  sourceHandle: string;
  /** Target field name (e.g. `input_images`). */
  targetHandle: string;
  /** Output type carried by the source, cached for fast validation. */
  refType: RefType;
  /** Scalar ref vs ordered multi-reference list. */
  cardinality: "scalar" | "list";
};

/** User-initiated connection intent (source output -> target field). */
export type CanvasConnection = {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
};

/** Per-step persisted layout (no React Flow metadata beyond position). */
export type SavedNodeLayout = { stepId: string; position: XYPosition };

export type SavedLayout = {
  version: number;
  /** Stable hash of step ids+types; mismatch discards the saved layout. */
  hash: string;
  nodes: SavedNodeLayout[];
  viewport?: Viewport;
};

/** Multi-image (Ingredients/Reference images) capability for a generation model.
 * Resolved by the canvas from backend model/provider metadata; NEVER hardcoded. */
export type ModelCapability = {
  multiImageInput: boolean;
  /** Maximum reference images when supported; undefined => unlimited. */
  maxImageInputs?: number;
};
export type ModelCapabilityMap = Record<string, ModelCapability>;

/** Result of full save-blocking workflow validation (plan §9). */
export type ValidationResult = {
  ok: boolean;
  errors: string[];
  byNode: Record<string, string[]>;
};

/** Result of a single connection attempt (plan §8). */
export type ConnectionValidation = {
  ok: boolean;
  reason?: string;
  /** True when valid except for order; the caller applies a stable automatic reorder. */
  requiresReorder?: boolean;
};

/** Config mutation produced by connect/disconnect. `value` follows the same
 * idempotent forms `buildBackendStepConfig` already accepts: a resolved
 * BackendInputRef for scalar refs, an ordered BackendInputRef[] for ref-lists,
 * or "" to clear a scalar ref. */
export type ConfigPatch = {
  stepId: string;
  field: string;
  value: BackendInputRef | BackendInputRef[] | "";
};
