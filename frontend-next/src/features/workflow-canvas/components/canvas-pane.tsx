/** Copyright 2026 Google LLC — Apache-2.0
 * Controlled React Flow pane for the workflow canvas. Thin presentation shell:
 * it owns the ReactFlow region, the fixed node types, Background/Controls/
 * MiniMap, attribution, a11y config, and disabled delete key. It holds NO graph
 * state — nodes/edges and every mutation callback (selection/connect/drop) are
 * supplied by the composition hook via props (plan §5, §6, §12). Dimensions
 * inherit 100% from the mounting editor so the editor owns the full-screen shell
 * and safe areas; this component never sets viewport units. */
"use client";

import type { ComponentProps, DragEventHandler } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type DefaultEdgeOptions,
  type Edge,
} from "@xyflow/react";

import { STEP_ACCENT_TOKEN, workflowNodeTypes, type WorkflowNode } from "./base-workflow-node";
import type { StepType } from "../../workflow-editor/types";

/** RF prop types are pulled from the component itself so we never guess
 * exported type names across versions. */
type ReactFlowProps = ComponentProps<typeof ReactFlow>;

/** Default presentation for derived edges (plan §12). A non-animated Bézier
 * curve with a filled arrowhead marker so flow direction is unambiguous, plus a
 * generous interaction hit-area for mouse/touch and keyboard focusability
 * (paired with `edgesFocusable`). Marker + stroke stay semantic tokens. */
export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  // React Flow v12 registers its Bézier edge under the built-in "default" key.
  type: "default",
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "var(--tri-border-strong)",
    width: 20,
    height: 20,
    markerUnits: "userSpaceOnUse",
  },
  interactionWidth: 28,
};

/** Edge stroke is class-driven (NOT inline) so selection / keyboard-focus can
 * override it by CSS specificity without a custom edge component or raw colors.
 * Base stroke + width come from semantic border tokens; a selected or focused
 * edge switches to the a11y focus-ring token and the focus stroke width.
 * `:focus-within` catches keyboard focus on the focusable interaction path
 * (`edgesFocusable` + `autoPanOnNodeFocus` keep edges reachable). */
const EDGE_STROKE_CLASSES =
  "[&_.react-flow__edge-path]:stroke-[var(--tri-border-strong)] " +
  "[&_.react-flow__edge-path]:[stroke-width:var(--tri-border-strong-width)] " +
  "[&_.react-flow__edge.selected_.react-flow__edge-path,&_.react-flow__edge:focus-within_.react-flow__edge-path]:stroke-[var(--tri-a11y-focus-ring)] " +
  "[&_.react-flow__edge.selected_.react-flow__edge-path,&_.react-flow__edge:focus-within_.react-flow__edge-path]:[stroke-width:var(--tri-border-focus-width)]";

export interface CanvasPaneProps {
  /** Controlled node/edge model (derived from the workflow draft by the hook). */
  nodes: WorkflowNode[];
  edges: Edge[];
  onNodesChange: ReactFlowProps["onNodesChange"];
  onEdgesChange: ReactFlowProps["onEdgesChange"];
  /** A connection was drawn — the hook maps it to a config ref patch. */
  onConnect: NonNullable<ReactFlowProps["onConnect"]>;
  /** Selection changed — the hook drives the inspector. */
  onSelectionChange?: ReactFlowProps["onSelectionChange"];
  /** Palette drop — the hook resolves the step type + screenToFlowPosition. */
  onDrop?: DragEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  /** Node moved — the hook persists layout (P1: local only). */
  onNodeDragStop?: ReactFlowProps["onNodeDragStop"];
  /** Live connection validation during drag (type/cardinality/capability). */
  isValidConnection?: ReactFlowProps["isValidConnection"];
  /** Follows the app `[data-theme]`; canvas defaults to the focused dark workspace. */
  colorMode?: NonNullable<ReactFlowProps["colorMode"]>;
  fitView?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** MiniMap fill per step kind — semantic data-viz alias, paired with the node
 * label in the main canvas (status/type never color-only). */
function nodeMinimapColor(node: WorkflowNode): string {
  return STEP_ACCENT_TOKEN[(node.type ?? "text") as StepType] ?? "var(--tri-data-viz-2)";
}

/** Always allow HTML5 drop so the palette drop fires; then forward to the hook. */
function makeDragOver(handler?: DragEventHandler<HTMLDivElement>): DragEventHandler<HTMLDivElement> {
  return (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    handler?.(event);
  };
}

export function CanvasPane({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  onDrop,
  onDragOver,
  onNodeDragStop,
  isValidConnection,
  colorMode = "dark",
  fitView = true,
  className = "",
  ariaLabel = "Workflow canvas. Drag from the palette to add steps, draw between ports to connect, use arrow keys to pan.",
}: CanvasPaneProps) {
  return (
    <div role="group" aria-label={ariaLabel} className={`relative h-full w-full ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={workflowNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={makeDragOver(onDragOver)}
        isValidConnection={isValidConnection}
        deleteKeyCode={null}
        nodesFocusable
        edgesFocusable
        disableKeyboardA11y={false}
        autoPanOnNodeFocus
        fitView={fitView}
        proOptions={{ hideAttribution: false }}
        colorMode={colorMode}
        connectionLineType={ConnectionLineType.Bezier}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        ariaLabelConfig={{
          "node.a11yDescription.default": "workflow step",
          "edge.a11yDescription.default": "workflow connection",
          "controls.ariaLabel": "Workflow zoom controls",
          "minimap.ariaLabel": "Workflow minimap",
          "handle.ariaLabel": "workflow connection port",
        }}
        className={`h-full w-full ${EDGE_STROKE_CLASSES}`}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--tri-border-subtle)" />
        {/* Overlay layout contract: the editor floats the palette over the left
          and the inspector over the right, each with a bottom inset, so these
          bottom corners stay clear. Controls (bottom-left) sits under the palette
          and MiniMap (bottom-right) under the inspector — neither panel covers
          them. Below `md` the floating WorkspaceSwitcher docks bottom-center and
          the Sidebar docks bottom (max-md), so both stay hidden on mobile;
          touch pinch-zoom/drag-pan + fitView cover mobile navigation. */}
        <Controls showInteractive={false} position="bottom-left" className="max-md:hidden" />
        <MiniMap position="bottom-right" pannable zoomable ariaLabel="Workflow minimap" nodeColor={nodeMinimapColor} className="max-md:hidden" />
      </ReactFlow>
    </div>
  );
}
