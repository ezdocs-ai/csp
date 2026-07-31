/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useMemo, useState } from "react";

import type { InputMode, InputParam, NodeType, StepType, WorkflowDraft, WorkflowStep } from "../types";
import { type ConfigValues, STEP_FIELDS, defaultStepConfig, missingRequired } from "./step-configs";
import { ensureSingleUserInputStep, generateStepId, normalizeWorkflowIdentifiers } from "./identifiers";
import { nodeTypeToStepType } from "../mapper";
import { outputsToParams, reorder } from "./transforms";

const emptyDraft: WorkflowDraft = { name: "", description: "", definition: { steps: [] } };
const makeStep = (type: StepType, id: string): WorkflowStep => ({
  id,
  type,
  label: type.replace("-", " "),
  inputs: [{ mode: "fixed" }],
  config: STEP_FIELDS[type].length ? defaultStepConfig(type) : undefined,
  // user_input steps start with an empty parameter list the editor fills in.
  inputParams: type === "user-input" ? [] : undefined,
});

/**
 * Accept both UI shape ({definition:{steps}} with UI step.type + config) and the
 * backend WorkflowModel shape (flat `steps` with backend discriminators + inputs/settings),
 * so the editor renders loaded drafts instead of crashing. Per-step inputs/settings are
 * folded into `config` so captured values survive a reload.
 * Compatibility adapter: normalizes wrapper, type discriminator, and config
 * carrier only — a full dtoToDraft reverse mapper is intentionally out of scope.
 */
function normalizeStep(raw: Record<string, unknown>): WorkflowStep {
  const rawType = String(raw.type ?? "");
  const uiType: StepType = (nodeTypeToStepType(rawType as NodeType) ?? (rawType as StepType));
  const id = (raw.id as string) ?? (raw.stepId as string) ?? generateStepId(uiType, []);
  let config = raw.config as ConfigValues | undefined;
  if (!config) {
    const backendInputs = (raw.inputs ?? {}) as Record<string, unknown>;
    const backendSettings = (raw.settings ?? {}) as Record<string, unknown>;
    if (Object.keys(backendInputs).length || Object.keys(backendSettings).length) {
      config = { ...backendInputs, ...backendSettings } as ConfigValues;
      // Flatten ref objects to "step::output" strings so the ref <select> can display them.
      for (const field of STEP_FIELDS[uiType] ?? []) {
        if (field.kind === "ref" && config[field.name] && typeof config[field.name] === "object") {
          const ref = config[field.name] as { step: string; output: string };
          config[field.name] = `${ref.step}::${ref.output}`;
        }
      }
    }
  }
  return {
    id,
    type: uiType,
    label: (raw.label as string) ?? (raw.stepId as string) ?? uiType.replace("-", " "),
    inputs: Array.isArray(raw.inputs) ? (raw.inputs as WorkflowStep["inputs"]) : [{ mode: "fixed" as InputMode }],
    outputRef: raw.outputRef as string | undefined,
    config,
    // Reverse the paramsToOutputs serialization so a saved user_input step reloads its params.
    inputParams: uiType === "user-input" ? outputsToParams(raw.outputs as Record<string, unknown> | undefined) : undefined,
  };
}

function normalizeInitial(input?: Partial<WorkflowDraft> & { steps?: unknown }): WorkflowDraft {
  if (!input) return { ...emptyDraft };
  const rawSteps = input.definition?.steps ?? (Array.isArray(input.steps) ? (input.steps as WorkflowStep[]) : []);
  return {
    id: input.id,
    name: input.name ?? "",
    description: input.description,
    definition: { steps: ensureSingleUserInputStep(rawSteps.map((step) => normalizeStep(step as unknown as Record<string, unknown>))) },
  };
}

async function csrfFetch(path: string, init: RequestInit = {}) {
  const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
  return fetch(path, { ...init, headers: { ...init.headers, "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken } });
}

export function useWorkflowEditor(initial?: Partial<WorkflowDraft> & { steps?: unknown }) {
  const [draft, setDraft] = useState<WorkflowDraft>(() => normalizeInitial(initial));

  const validation = useMemo(() => {
    const ids = new Set(draft.definition.steps.map((step) => step.id));
    const errors: string[] = [];
    if (!draft.name.trim()) errors.push("Workflow name is required.");
    draft.definition.steps.forEach((step, index) => {
      if (!step.label.trim()) errors.push(`Step ${index + 1} needs a label.`);
      if (step.outputRef && !ids.has(step.outputRef)) errors.push(`Step ${index + 1} output reference is invalid.`);
      step.inputs.forEach((input) => { if (input.mode === "linked" && !input.sourceStepId) errors.push(`Step ${index + 1} linked input needs a source step.`); });
      // Per-type required config: block save rather than send a payload the backend will 422.
      const missing = missingRequired(step.type, step.config ?? defaultStepConfig(step.type));
      for (const field of missing) errors.push(`Step ${index + 1} (${step.type}) is missing: ${field}.`);
    });
    return errors;
  }, [draft]);

  const addStep = (type: StepType) => setDraft((current) => ({ ...current, definition: { steps: [...current.definition.steps, makeStep(type, generateStepId(type, current.definition.steps.map((step) => step.id)))] } }));
  const removeStep = (id: string) => setDraft((current) => ({ ...current, definition: { steps: current.definition.steps.filter((step) => step.id !== id) } }));
  const moveStep = (id: string, direction: -1 | 1) => setDraft((current) => {
    const steps = [...current.definition.steps]; const from = steps.findIndex((step) => step.id === id); const to = from + direction;
    if (from < 0 || to < 0 || to >= steps.length) return current;
    [steps[from], steps[to]] = [steps[to], steps[from]];
    return { ...current, definition: { steps } };
  });
  const updateStep = (id: string, update: Partial<WorkflowStep>) => setDraft((current) => ({ ...current, definition: { steps: current.definition.steps.map((step) => step.id === id ? { ...step, ...update } : step) } }));
  const updateStepConfig = (id: string, patch: Partial<ConfigValues>) => setDraft((current) => ({
    ...current,
    definition: { steps: current.definition.steps.map((step) => {
      if (step.id !== id) return step;
      const base = step.config ?? defaultStepConfig(step.type);
      return { ...step, config: { ...base, ...(patch as ConfigValues) } };
    }) },
  }));
  const updateInputParams = (id: string, params: InputParam[]) => setDraft((current) => ({
    ...current,
    definition: { steps: current.definition.steps.map((step) => (step.id === id ? { ...step, inputParams: params } : step)) },
  }));
  /** Index-based reorder (drag-reorder). Direction-based moveStep stays for the buttons. */
  const reorderSteps = (from: number, to: number) => setDraft((current) => ({ ...current, definition: { steps: reorder(current.definition.steps, from, to) } }));
  /**
   * Atomic batch replacement of the whole step array (one `setDraft`, no render gap).
   * Used by the canvas for explicit confirmed topological reorder, node add, and
   * guarded node delete. Preserves `name`/`description`/`id`; ordinary edits and
   * save NEVER go through this. Plan §9 (reorder) + §5 (single canonical draft).
   */
  const replaceSteps = (steps: WorkflowStep[]) => setDraft((current) => ({ ...current, definition: { steps } }));
  const setMeta = (update: Partial<Pick<WorkflowDraft, "name" | "description">>) => setDraft((current) => ({ ...current, ...update }));

  const save = async (): Promise<{ id: string }> => {
    if (validation.length) throw new Error(validation[0]);
    // v2 singleton normalization + identifier-safe migration before persisting.
    const normalizedSteps = normalizeWorkflowIdentifiers(ensureSingleUserInputStep(draft.definition.steps));
    const path = draft.id ? `/api/workflows/${encodeURIComponent(draft.id)}/update` : "/api/workflows/create";
    const response = await csrfFetch(path, { method: "POST", body: JSON.stringify({ name: draft.name, description: draft.description, definition: { steps: normalizedSteps } }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data === "object" && data !== null && "error" in data ? String(data.error) : "Workflow save failed");
    const id = (typeof data === "object" && data !== null && "id" in data ? String(data.id) : draft.id) ?? "";
    // Latch id + reflect normalized ids locally so subsequent edits/saves stay safe.
    setDraft((current) => ({ ...current, id: id || current.id, definition: { steps: normalizedSteps } }));
    return { id };
  };

  return { draft, addStep, removeStep, moveStep, reorderSteps, replaceSteps, updateStep, updateStepConfig, updateInputParams, setMeta, save, validation };
}
