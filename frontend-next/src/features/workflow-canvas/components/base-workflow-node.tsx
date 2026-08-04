/** Copyright 2026 Google LLC — Apache-2.0
 * Visual workflow node for the React Flow canvas. Pure presentation: it derives
 * typed source/target handles from the static `STEP_FIELDS` / `STEP_OUTPUTS`
 * contract plus node `data`, and renders them with semantic tokens only. It owns
 * NO graph state — selection/connect/drop are wired by the composition hook
 * (`use-workflow-canvas`) via `CanvasPane` props. Handle ids match the field /
 * output names the graph adapter already emits (plan §7, §8). */
"use client";

import { memo, useEffect, type CSSProperties } from "react";
import { Handle, NodeTypes, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";

import {
  STEP_FIELDS,
  STEP_OUTPUTS,
  refListVisibleFor,
  type RefType,
  type StepFieldSpec,
} from "../../workflow-editor/hooks/step-configs";
import { normalizeParamOutputName } from "../../workflow-editor/hooks/identifiers";
import type { StepType } from "../../workflow-editor/types";
import type { WorkflowCanvasNodeData } from "../graph-types";

/** RF node type — `type` is the backend/UI StepType so `nodeTypes` keys line up
 * with the StepType discriminated workflow steps. `node.id === stepId`. */
export type WorkflowNode = Node<WorkflowCanvasNodeData, StepType>;

/** One connection point on a node. `id` MUST equal the field name (target) or
 * the output name (source) so edges round-trip through the graph adapter. */
export interface WorkflowHandleSpec {
  id: string;
  label: string;
  refType: RefType;
  side: "source" | "target";
  /** ref-list target accepts multiple ordered incoming edges. */
  multi?: boolean;
  required?: boolean;
}

/** Friendly product label per node kind (paired with the accent dot — status/type
 * is never communicated by color alone, plan §12 / theme rule 4). */
const STEP_TYPE_LABEL: Record<StepType, string> = {
  "user-input": "User input",
  text: "Generate text",
  image: "Generate image",
  edit: "Edit image",
  video: "Generate video",
  vto: "Virtual try-on",
  audio: "Generate audio",
};

/** Semantic data-visualization token per step kind — used for the header accent
 * dot and the MiniMap node fills. These are semantic aliases, not raw palette. */
export const STEP_ACCENT_TOKEN: Record<StepType, string> = {
  "user-input": "var(--tri-data-viz-7)",
  text: "var(--tri-data-viz-2)",
  image: "var(--tri-data-viz-1)",
  edit: "var(--tri-data-viz-5)",
  video: "var(--tri-data-viz-3)",
  vto: "var(--tri-data-viz-6)",
  audio: "var(--tri-data-viz-4)",
};

const OUTPUT_LABEL: Record<string, string> = {
  generated_text: "Text",
  generated_image: "Image",
  edited_image: "Edited image",
  generated_video: "Video",
  generated_audio: "Audio",
};

/** Product label for a node, resolving the canvas-only variant first so the
 *  virtual input nodes and the Ingredients-to-Image render read as distinct nodes
 *  while their backend stepType stays unchanged. Paired with the accent dot so
 *  type/identity is never communicated by color alone (plan §12 / theme rule 4). */
export function nodeTypeLabel(data: WorkflowCanvasNodeData): string {
  switch (data.canvasKind) {
    case "text-input":
      return "Text input";
    case "image-input":
      return "Image input";
    case "ingredients-image":
      return "Ingredients to image";
    default:
      return STEP_TYPE_LABEL[data.stepType];
  }
}

/** Semantic accent token per node kind. Virtual inputs and the Ingredients-to-Image
 *  variant get accents distinct from their underlying backend step so each canvas
 *  node reads as a separate visual kind (semantic aliases, never raw palette). */
export function nodeAccent(data: WorkflowCanvasNodeData): string {
  switch (data.canvasKind) {
    case "text-input":
      return "var(--tri-data-viz-7)";
    case "image-input":
      return "var(--tri-data-viz-6)";
    case "ingredients-image":
      return "var(--tri-data-viz-5)";
    default:
      return STEP_ACCENT_TOKEN[data.stepType];
  }
}

/** Execution-order badge text, or null to render no badge. Virtual input nodes
 *  carry `order: null` (they project the hidden singleton, which has no visible
 *  executable order), so the order chip is suppressed on them. Pure. */
export function orderBadge(order: number | null): string | null {
  return order === null ? null : `#${order}`;
}

/** Source handles a node exposes.
 *  - generated steps: one per `STEP_OUTPUTS[type]`;
 *  - user-input: dynamic, one per normalized run-time parameter (mirrors the
 *    graph adapter's `outputSpecsFor` so ids agree). */
export function sourceHandleSpecs(data: WorkflowCanvasNodeData): WorkflowHandleSpec[] {
  // Virtual input nodes (canvasKind text-input/image-input) project the hidden
  // singleton's run-time parameters; their one source handle id MUST equal the
  // single projected param output (normalizeParamOutputName) so edges compiled as
  // `{step: singletonStepId, output: normalizedOutput}` dock to the right port.
  if (data.stepType === "user-input") {
    return (data.inputParams ?? [])
      .map((p) => ({ name: normalizeParamOutputName(p.name), type: p.type }))
      .filter((o) => o.name.length > 0)
      .map((o) => ({
        id: o.name,
        label: o.name,
        refType: o.type === "image" ? "image" : "text",
        side: "source" as const,
      }));
  }
  return (STEP_OUTPUTS[data.stepType] ?? []).map((o) => ({
    id: o.name,
    label: OUTPUT_LABEL[o.name] ?? o.name,
    refType: o.type,
    side: "source",
  }));
}

/** A field accepts an incoming connection (becomes one scalar target) when it is
 *  a declared `ref`, a `ref-list`, or a text/textarea field marked `acceptsRef`
 *  (prompt templating consumes one whole-value StepOutputReference). */
function acceptsRef(field: StepFieldSpec): boolean {
  return field.kind === "ref" || field.kind === "ref-list" || field.acceptsRef === true;
}

/** A ref-list is hidden ONLY when its field metadata explicitly requires the
 *  image-ingredients capability the selected model lacks (`isModelGatedRefList`).
 *  Generic ref-lists (text/video fan-in) and scalar/acceptsRef fields are always
 *  shown. The single source of truth is `refListVisibleFor`; the node only reads
 *  it (plan §7). */
function isRefListVisible(field: StepFieldSpec, data: WorkflowCanvasNodeData): boolean {
  if (field.kind !== "ref-list") return true;
  return refListVisibleFor(field, String(data.config.model ?? ""));
}

/** Target handles a node accepts: one per field that accepts a ref, minus
 *  capability-gated image ref-lists the current model cannot consume. */
export function targetHandleSpecs(data: WorkflowCanvasNodeData): WorkflowHandleSpec[] {
  return STEP_FIELDS[data.stepType]
    .filter((f) => acceptsRef(f) && isRefListVisible(f, data))
    .map((f) => ({
      id: f.name,
      label: f.label,
      refType: f.refType ?? "text",
      side: "target" as const,
      multi: f.kind === "ref-list",
      required: f.required,
    }));
}

/** Stable, order-independent signature of a node's connection surface: ids +
 *  refType per side (multi flag distinguishes a ref-list from a scalar ref). Used
 *  to detect that the handle geometry changed so React Flow can be told to
 *  recompute handle positions via `useUpdateNodeInternals` (dynamic user-input
 *  params, model/capability gating, scalar/ref-list field changes). */
export function handleSignature(targets: WorkflowHandleSpec[], sources: WorkflowHandleSpec[]): string {
  const t = targets
    .map((h) => `t:${h.id}:${h.refType}${h.multi ? "*" : ""}`)
    .sort()
    .join("|");
  const s = sources
    .map((h) => `s:${h.id}:${h.refType}`)
    .sort()
    .join("|");
  return `${t}__${s}`;
}

/** Visible dot diameter — kept compact so the node never visually bloats. */
export const HANDLE_VISIBLE_SIZE = 11;
/** Effective pointer hit area. >=28px for finger-friendly discoverability
 *  (plan §12 / a11y touch-target rule). Implemented as a transparent box whose
 *  own bounding rect is what React Flow measures for connection hit-testing and
 *  snapping — the small visible dot is a child element, so the target grows
 *  without enlarging the visual footprint. */
export const HANDLE_HIT_SIZE = 28;
const HANDLE_HIT_OVERFLOW = (HANDLE_HIT_SIZE - HANDLE_VISIBLE_SIZE) / 2;

/** Transparent hit box. Negative margins collapse its flex footprint back to the
 *  visible dot size so the labeled-handle rows don't grow; the transparent
 *  remainder overflows into the node padding / row gaps only (invisible). React
 *  Flow's `.connectionindicator` class already sets `pointer-events: all` on
 *  connectable handles, so this box IS the grab/snap target — we intentionally
 *  do NOT set `pointer-events` here. Same object for both sides: the dot is
 *  centered, so target/source just differ by the RF `Position` edge metadata. */
export const HANDLE_HIT_BOX_STYLE: CSSProperties = {
  position: "relative",
  inset: "auto",
  transform: "none",
  width: HANDLE_HIT_SIZE,
  height: HANDLE_HIT_SIZE,
  marginTop: -HANDLE_HIT_OVERFLOW,
  marginRight: -HANDLE_HIT_OVERFLOW,
  marginBottom: -HANDLE_HIT_OVERFLOW,
  marginLeft: -HANDLE_HIT_OVERFLOW,
  background: "transparent",
  border: "none",
  borderRadius: "var(--tri-radius-full)",
};

/** Compact visual dot, centered in the hit box and purely decorative
 *  (`pointer-events: none`) so every pointer event in the box resolves to the
 *  handle element itself. Neutral token fill — type is conveyed by the adjacent
 *  label, not by handle color. */
export const HANDLE_DOT_STYLE: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: HANDLE_VISIBLE_SIZE,
  height: HANDLE_VISIBLE_SIZE,
  transform: "translate(-50%, -50%)",
  background: "var(--tri-border-strong)",
  border: "2px solid var(--tri-bg-surface)",
  borderRadius: "var(--tri-radius-full)",
  pointerEvents: "none",
};

export function BaseWorkflowNode({ id, data, selected }: NodeProps<WorkflowNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const targets = targetHandleSpecs(data);
  const sources = sourceHandleSpecs(data);
  const typeLabel = nodeTypeLabel(data);
  const accent = nodeAccent(data);
  const badge = orderBadge(data.order);

  // Dynamic handles (user-input params, capability-gated image ref-lists, scalar
  // ref fields) change this node's connection surface. Tell React Flow to
  // recompute handle geometry AFTER the handles are committed to the DOM
  // (useEffect runs post-commit) so edges stay docked to the right port (plan §7,
  // RF useUpdateNodeInternals docs). The signature is order-independent so a
  // stable surface never triggers a spurious update.
  const signature = handleSignature(targets, sources);
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, signature, updateNodeInternals]);

  return (
    <article
      role="group"
      data-tri-step-type={data.stepType}
      data-tri-canvas-kind={data.canvasKind ?? data.stepType}
      data-selected={selected || undefined}
      aria-label={badge ? `${typeLabel} node: ${data.label}. Execution order ${badge}.` : `${typeLabel} node: ${data.label}.`}
      // Selection signal is border + shadow (not color-only). Keyboard focus ring
      // is layered on via the RF node-wrapper :focus-visible variant below.
      style={{
        minWidth: 220,
        maxWidth: 264,
        background: "var(--tri-bg-surface)",
        border: `1px solid var(--tri-border-${selected ? "strong" : "default"})`,
        borderRadius: "var(--tri-radius-md)",
        boxShadow: selected ? "var(--tri-shadow-md)" : "var(--tri-shadow-sm)",
      }}
      className="motion-safe:transition-[box-shadow,border-color] motion-reduce:transition-none [.react-flow__node:focus-visible_&]:outline-[3px_solid_var(--tri-a11y-focus-ring)] [.react-flow__node:focus-visible_&]:outline-offset-2"
    >
      <header
        className="flex items-center gap-[var(--tri-space-2)] border-b border-[var(--tri-border-subtle)] px-[var(--tri-space-3)] py-[var(--tri-space-2)]"
        style={{ borderColor: "var(--tri-border-subtle)" }}
      >
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: accent }} />
        {/* Node label is the canvas-level heading for this step (paired with the
          accent dot + order chip, so type/identity is never color-only). */}
        <h3 className="truncate text-[length:var(--tri-label-button-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">
          {data.label}
        </h3>
        {badge ? (
          <span
            aria-hidden="true"
            className="ml-auto shrink-0 font-[var(--tri-font-code)] text-[length:var(--tri-label-overline-size)] text-[var(--tri-text-tertiary)]"
          >
            {badge}
          </span>
        ) : null}
      </header>

      <div className="flex flex-col gap-1.5 px-[var(--tri-space-3)] py-[var(--tri-space-2)] text-[length:var(--tri-label-overline-size)]">
        <span className="font-[var(--tri-font-code)] uppercase tracking-[0.12em] text-[var(--tri-text-tertiary)]">
          {typeLabel}
        </span>

        {targets.length === 0 && sources.length === 0 ? (
          <p className="text-[var(--tri-text-tertiary)]">No connection ports.</p>
        ) : null}

        {targets.map((t) => (
          <div key={`t-${t.id}`} className="nodrag flex items-center gap-[var(--tri-space-2)]">
            <Handle
              id={t.id}
              type="target"
              position={Position.Left}
              style={HANDLE_HIT_BOX_STYLE}
              aria-label={`Input ${t.label} (${t.refType})${t.multi ? ", accepts multiple" : ""}${t.required ? ", required" : ""}`}
            >
              <span aria-hidden="true" style={HANDLE_DOT_STYLE} />
            </Handle>
            <span className="text-[var(--tri-text-secondary)]">{t.label}</span>
            {t.multi ? <span className="text-[var(--tri-text-tertiary)]">· multi</span> : null}
            {t.required ? <span className="text-[var(--tri-text-tertiary)]">· required</span> : null}
          </div>
        ))}

        {sources.map((s) => (
          <div key={`s-${s.id}`} className="nodrag flex items-center justify-end gap-[var(--tri-space-2)]">
            <span className="text-[var(--tri-text-secondary)]">{s.label}</span>
            <Handle
              id={s.id}
              type="source"
              position={Position.Right}
              style={HANDLE_HIT_BOX_STYLE}
              aria-label={`Output ${s.label} (${s.refType})`}
            >
              <span aria-hidden="true" style={HANDLE_DOT_STYLE} />
            </Handle>
          </div>
        ))}
      </div>

      {data.validation.length > 0 ? (
        <ul
          role="status"
          aria-live="polite"
          className="mx-[var(--tri-space-3)] mb-[var(--tri-space-2)] list-disc pl-[var(--tri-space-4)] text-[length:var(--tri-label-overline-size)] text-[var(--tri-state-error)]"
        >
          {data.validation.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/** One shared node component for all seven executor step kinds (plan §7). Defined
 * at module scope so the `nodeTypes` reference is stable across renders. */
export const WorkflowBaseNode = memo(BaseWorkflowNode);

export const workflowNodeTypes: NodeTypes = {
  "user-input": WorkflowBaseNode,
  text: WorkflowBaseNode,
  image: WorkflowBaseNode,
  edit: WorkflowBaseNode,
  video: WorkflowBaseNode,
  vto: WorkflowBaseNode,
  audio: WorkflowBaseNode,
};
