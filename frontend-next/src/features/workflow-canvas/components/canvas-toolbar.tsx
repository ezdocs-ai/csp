/** Copyright 2026 Google LLC — Apache-2.0
 * Top command bar for the full-screen workflow canvas. Pure presentation shell —
 * all state is supplied via props; composition (useWorkflowEditor/save/run wiring)
 * happens in the canvas editor. See plan §6 "Top toolbar".
 *
 * Status/validation copy is direct, never color-only. 44px targets come from the
 * shared Button/Input primitives (min-height = --tri-button-height/--tri-input-height). */
"use client";

import { useId, useState } from "react";
import { Badge, Button, Field, Input } from "@/src/components/ui";
import type { BadgeTone } from "@/src/components/ui/badge";

export type WorkflowStatus = { label: string; tone: BadgeTone };

/** Combine saved/draft/dirty + validity into a single status badge value. Pure. */
export function formatWorkflowStatus(saved: boolean, dirty: boolean, valid: boolean): WorkflowStatus {
  if (dirty) return { label: "Unsaved changes", tone: "warning" };
  if (saved) return { label: "Saved", tone: valid ? "success" : "neutral" };
  return { label: "Draft", tone: "neutral" };
}

/** Tooltip shown when Run is disabled. Pure. */
export function runDisabledReason(args: { saved: boolean; valid: boolean }): string {
  if (!args.saved) return "Save the workflow first";
  if (!args.valid) return "Resolve validation errors first";
  return "";
}

export interface CanvasToolbarProps {
  /** Heading copy, e.g. "New workflow" / "Edit workflow". */
  title: string;
  name: string;
  onNameChange: (name: string) => void;
  description?: string;
  onDescriptionChange?: (description: string) => void;
  saved: boolean;
  dirty: boolean;
  valid: boolean;
  /** Total save-blocking validation error count. */
  validationCount: number;
  onOpenValidation: () => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  canRun: boolean;
  /** Overrides the default disabled tooltip when present. */
  runTooltip?: string;
  onRun: () => void;
  onBack: () => void;
}

export function CanvasToolbar({
  title,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  saved,
  dirty,
  valid,
  validationCount,
  onOpenValidation,
  saving,
  canSave,
  onSave,
  canRun,
  runTooltip,
  onRun,
  onBack,
}: CanvasToolbarProps) {
  const nameId = useId();
  const descId = useId();
  const status = formatWorkflowStatus(saved, dirty, valid);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const runHint = runTooltip ?? runDisabledReason({ saved, valid });
  const validationLabel = validationCount === 0 ? "Valid" : `${validationCount} issue${validationCount === 1 ? "" : "s"}`;

  return (
    <header
      aria-label="Workflow toolbar"
      className="flex min-w-0 flex-wrap items-center gap-[var(--tri-space-2)] border-b border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] px-[var(--tri-space-3)] py-[var(--tri-space-2)]"
    >
      <Button
        aria-label="Back to workflows"
        title="Back to workflows"
        variant="secondary"
        className="min-h-11 min-w-11 px-3"
        onClick={onBack}
      >
        ←
      </Button>

      <h1 className="font-[var(--tri-font-display)] text-[var(--tri-text-h4-size)] leading-[var(--tri-text-h4-line-height)]">
        {title}
      </h1>

      <label className="sr-only" htmlFor={nameId}>Workflow name</label>
      <Input
        id={nameId}
        className="min-w-0 max-w-[16rem] flex-1"
        placeholder="Workflow name"
        value={name}
        aria-label="Workflow name"
        invalid={!name.trim()}
        onChange={(event) => onNameChange(event.target.value)}
      />

      <Badge tone={status.tone}>{status.label}</Badge>

      <Button
        aria-expanded={detailsOpen}
        aria-haspopup="true"
        aria-label="Edit workflow details"
        title="Edit workflow details"
        variant="ghost"
        className="min-h-11 min-w-11 px-3"
        onClick={() => setDetailsOpen((open) => !open)}
      >
        Details
      </Button>

      <div role="status" aria-live="polite" className="contents">
        <Button
          aria-label={`Workflow validation: ${validationLabel}`}
          title="Show validation"
          variant={validationCount === 0 ? "secondary" : "danger"}
          className="min-h-11 px-3"
          onClick={onOpenValidation}
        >
          {validationLabel}
        </Button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-[var(--tri-space-2)]">
        <Button
          aria-label="Save workflow"
          disabled={saving || !canSave}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          aria-label="Run workflow"
          disabled={!canRun}
          title={canRun ? undefined : runHint}
          variant="secondary"
          onClick={onRun}
        >
          ▶ Run
        </Button>
      </div>

      {detailsOpen ? (
        <div className="basis-full">
          <Field htmlFor={descId} label="Description">
            <textarea
              id={descId}
              className="min-h-20 w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] p-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)] placeholder:text-[var(--tri-text-tertiary)] focus:border-[var(--tri-input-focus-border)]"
              placeholder="Describe what this workflow does"
              value={description ?? ""}
              onChange={(event) => onDescriptionChange?.(event.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </header>
  );
}
