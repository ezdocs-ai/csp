/** Copyright 2026 Google LLC — Apache-2.0
 * Left node palette rail for the canvas. Pure presentation shell driven by props;
 * the canvas editor wires `onAdd`/`onStartDrag`. Drag uses native HTML5 DnD
 * (`application/x-tri-workflow-step`) carrying a `CanvasAddKind`; the canvas pane
 * reads that key on drop via `parseDragKind`.
 *
 * v2 independent-input UX (Serena memory `v2_independent_input_nodes`): the
 * singleton multi-parameter `User input` item is GONE. The Inputs group exposes
 * `Text input` / `Image input` (each appends one parameter to the hidden singleton
 * and is allowed multiple times), and the Generate group adds a distinct
 * `Ingredients to image` item alongside the ordinary Generate steps. No item is
 * ever singleton-disabled. */
"use client";

import { useId } from "react";

import { Button, Tooltip } from "@/src/components/ui";
import type { StepType } from "@/src/features/workflow-editor/types";
import type { CanvasAddKind } from "../graph-types";

/** Native DnD payload key the canvas pane reads to add a dragged node. */
export const STEP_DRAG_TYPE = "application/x-tri-workflow-step";

/** Every palette kind's backing backend executor step type. Virtual input kinds
 *  (text-input/image-input) project the hidden singleton user_input step;
 *  ingredients-image renders an ordinary `image` backend step. Pure, total. */
export function backendStepTypeForKind(kind: CanvasAddKind): StepType {
  if (kind === "text-input" || kind === "image-input") return "user-input";
  if (kind === "ingredients-image") return "image";
  return kind;
}

export type PaletteGroupDef = { id: string; label: string; kinds: CanvasAddKind[] };

/** Static grouping/order: Inputs (independent, multiple allowed), Generate,
 *  Transform. No `user-input` singleton item. */
export const PALETTE_GROUPS: PaletteGroupDef[] = [
  { id: "inputs", label: "Inputs", kinds: ["text-input", "image-input"] },
  { id: "generate", label: "Generate", kinds: ["ingredients-image", "image", "text", "video", "audio"] },
  { id: "transform", label: "Transform", kinds: ["edit", "vto"] },
];

export type PaletteItemDisplay = { kind: CanvasAddKind; label: string; purpose: string; glyph: string };

/** Human label/purpose/glyph per palette kind. */
export const STEP_DISPLAY: Record<CanvasAddKind, PaletteItemDisplay> = {
  "text-input": { kind: "text-input", label: "Text input", purpose: "Collect a run-time text argument", glyph: "T" },
  "image-input": { kind: "image-input", label: "Image input", purpose: "Collect a run-time image argument", glyph: "▦" },
  "ingredients-image": { kind: "ingredients-image", label: "Ingredients to image", purpose: "Fuse reference images into one", glyph: "❖" },
  text: { kind: "text", label: "Generate text", purpose: "LLM text response", glyph: "T" },
  image: { kind: "image", label: "Generate image", purpose: "Text-to-image model", glyph: "▦" },
  video: { kind: "video", label: "Generate video", purpose: "Text-to-video model", glyph: "▷" },
  audio: { kind: "audio", label: "Generate audio", purpose: "Music or speech model", glyph: "♪" },
  edit: { kind: "edit", label: "Edit image", purpose: "Transform a prior image", glyph: "✎" },
  vto: { kind: "vto", label: "Virtual try-on", purpose: "Garment on a model image", glyph: "◯" },
};

const DRAG_KINDS: readonly string[] = Object.keys(STEP_DISPLAY);

/** Resolve each palette item's display. Pure; nothing is disabled — the v2 Inputs
 *  are independent and may repeat, and the singleton-disable rule was removed. */
export function resolvePaletteItems(): PaletteItemDisplay[] {
  return PALETTE_GROUPS.flatMap((group) => group.kinds).map((kind) => STEP_DISPLAY[kind]);
}

/** Type-safe parser for the DnD payload string. Returns the CanvasAddKind only
 *  when the value is one of the recognized palette kinds, else null. Pure. */
export function parseDragKind(value: string | null | undefined): CanvasAddKind | null {
  if (!value) return null;
  return DRAG_KINDS.includes(value) ? (value as CanvasAddKind) : null;
}

export interface StepPaletteRailProps {
  onAdd: (kind: CanvasAddKind) => void;
  /** Fired when a drag starts (the canvas may set a drop affordance). */
  onStartDrag?: (kind: CanvasAddKind) => void;
  /** Desktop uses the compact icon rail; mobile drawers keep the labeled list. */
  variant?: "rail" | "list";
}

export function StepPaletteRail({ onAdd, onStartDrag, variant = "list" }: StepPaletteRailProps) {
  const items = resolvePaletteItems();
  const headingPrefix = useId();
  const rail = variant === "rail";
  return (
    <aside
      aria-label="Step palette"
      className={
        rail
          ? "flex w-full min-w-0 flex-row items-center gap-[var(--tri-space-2)] overflow-visible bg-[var(--tri-bg-surface)] p-[var(--tri-space-2)]"
          : "flex min-h-0 w-full min-w-0 flex-col gap-[var(--tri-space-3)] overflow-y-auto border-r border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-2)]"
      }
    >
      {PALETTE_GROUPS.map((group, groupIndex) => {
        const groupItems = items.filter((item) => group.kinds.includes(item.kind));
        if (groupItems.length === 0) return null;
        const headingId = `${headingPrefix}-palette-group-${group.id}`;
        return (
          <section
            key={group.id}
            aria-labelledby={headingId}
            className={rail ? "grid grid-flow-col place-items-center gap-[var(--tri-space-1)]" : "grid w-full gap-[var(--tri-space-1)]"}
          >
            {rail && groupIndex > 0 ? (
              <hr aria-hidden="true" className="mx-[var(--tri-space-1)] h-8 w-px self-center border-0 border-l border-[var(--tri-border-subtle)]" />
            ) : null}
            <h2
              id={headingId}
              className={
                rail
                  ? "sr-only"
                  : "justify-self-stretch text-[length:var(--tri-label-overline-size)] font-[var(--tri-font-weight-semibold)] uppercase tracking-[var(--tri-label-overline-tracking)] text-[var(--tri-text-tertiary)]"
              }
            >
              {group.label}
            </h2>
            <ul className={rail ? "grid grid-flow-col gap-[var(--tri-space-1)]" : "grid w-full gap-[var(--tri-space-1)]"}>
              {groupItems.map((item) => (
                <li key={item.kind}>
                  <PaletteRow item={item} onAdd={onAdd} onStartDrag={onStartDrag} variant={variant} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

function PaletteRow({ item, onAdd, onStartDrag, variant }: { item: PaletteItemDisplay; onAdd: (kind: CanvasAddKind) => void; onStartDrag?: (kind: CanvasAddKind) => void; variant: "rail" | "list" }) {
  const handleDragStart = (event: React.DragEvent<HTMLElement>) => {
    event.dataTransfer.setData(STEP_DRAG_TYPE, item.kind);
    event.dataTransfer.effectAllowed = "move";
    onStartDrag?.(item.kind);
  };

  if (variant === "rail") {
    return (
      <div draggable onDragStart={handleDragStart} className="grid cursor-grab place-items-center rounded-[var(--tri-radius-md)] border border-transparent focus-within:border-[var(--tri-border-strong)] hover:border-[var(--tri-border-subtle)]">
        <Tooltip position="bottom" content={item.label}>
          <Button
            aria-label={`Add ${item.label}`}
            variant="iconOnly"
            className="cursor-grab text-[var(--tri-brand-violet)]"
            onClick={() => onAdd(item.kind)}
          >
            <span aria-hidden="true">{item.glyph}</span>
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={item.label}
      draggable
      onDragStart={handleDragStart}
      className="flex min-w-0 items-center gap-[var(--tri-space-2)] rounded-[var(--tri-radius-md)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] px-[var(--tri-space-2)] py-[var(--tri-space-1)] cursor-grab hover:border-[var(--tri-border-default)] focus-within:border-[var(--tri-border-strong)]"
      title={`Drag or add ${item.label}`}
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[var(--tri-radius-sm)] bg-[var(--tri-bg-surface)] text-[length:var(--tri-text-caption-size)] text-[var(--tri-brand-violet)]">
        {item.glyph}
      </span>
      <span className="min-w-0 flex-1 truncate text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)]">
        {item.label}
      </span>
      <Button
        aria-label={`Add ${item.label}`}
        title={`Add ${item.label}`}
        variant="secondary"
        className="min-h-11 min-w-11 px-3"
        onClick={() => onAdd(item.kind)}
      >
        +
      </Button>
    </div>
  );
}
