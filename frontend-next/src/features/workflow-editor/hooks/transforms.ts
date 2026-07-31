/** Copyright 2026 Google LLC — Apache-2.0
 * Pure transforms for the workflow editor: user_input parameter <-> backend outputs
 * serialization, identifier normalization, and list reordering. No React, no side effects.
 *
 * Backend contract (src/workflows/schema/workflow_model.py): a user_input step carries its
 * run-time parameters in `outputs` (`dict[str, Any]`) as `{ name: { type } }`. The yaml
 * generator reads step.outputs to build workflow args; `inputs`/`settings` forbid extra keys.
 */
import type { InputParam, InputParamType } from "../types";

/** Display name -> backend-safe identifier (lower snake). Matches Angular toIdentifier. */
export function toIdentifier(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** user_input parameter output name: lower-snake, digit-prefixed (`input_`). Empty for blanks.
 *  Canonical normalizer (single source of truth) — lives here beside toIdentifier to keep the
 *  dependency graph acyclic; identifiers.ts re-exports for legacy consumers. */
export function normalizeParamOutputName(name: string): string {
  const id = toIdentifier(name);
  if (!id) return "";
  return /^\d/.test(id) ? `input_${id}` : id;
}

/** user_input step.inputParams -> backend user_input step.outputs ({ name: { type } }). */
export function paramsToOutputs(params: readonly InputParam[]): Record<string, { type: InputParamType }> {
  const outputs: Record<string, { type: InputParamType }> = {};
  for (const param of params) {
    // Canonical normalizer: leading-digit `input_` prefix keeps paramsToOutputs in
    // lockstep with save-time normalizeWorkflowIdentifiers in identifiers.ts.
    const id = normalizeParamOutputName(param.name);
    if (!id) continue; // skip blanks so an empty "new param" row never serializes
    outputs[id] = { type: param.type };
  }
  return outputs;
}

/** backend user_input step.outputs -> editor inputParams (round-trip on load). */
export function outputsToParams(outputs: Record<string, unknown> | undefined | null): InputParam[] {
  if (!outputs) return [];
  const params: InputParam[] = [];
  for (const [name, value] of Object.entries(outputs)) {
    if (!value || typeof value !== "object" || !("type" in value)) continue;
    const type = (value as { type: unknown }).type === "image" ? "image" : "text";
    params.push({ name, type });
  }
  return params;
}

/** Immutable list reorder: remove the item at `from`, insert it at `to`. No-op on bad indices. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
