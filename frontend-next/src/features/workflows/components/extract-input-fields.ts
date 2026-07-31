/** Copyright 2026 Google LLC — Apache-2.0
 * Pure extractor for run-form fields from a workflow definition.
 *
 * Backend contract (src/workflows/schema/workflow_model.py + Angular
 * run-workflow-modal.component): a `user_input` step carries its run-time
 * parameters in `outputs` as `{ name: { type: "text" | "image" } }`. Legacy
 * shapes kept `inputs`/`fields` as plain name maps (treated as text). This
 * helper reads `outputs` first, then falls back to the legacy maps, and
 * accepts both a `{ steps: [...] }` envelope and a bare step/array/object.
 */
export type RunInputFieldType = "text" | "image";
export type RunInputField = { name: string; type: RunInputFieldType };

const USER_INPUT_TYPE = /user[-_]input/i;

/** Infer a single field type from an `outputs` spec value. Unknown -> text. */
function fieldType(spec: unknown): RunInputFieldType {
  return spec && typeof spec === "object" && (spec as { type?: unknown }).type === "image" ? "image" : "text";
}

/** Extract user-input fields ({name,type}) from a workflow definition.
 * De-dupes by name, preserves first-seen order. Returns [] on bad input. */
export function extractInputFields(definition: unknown): RunInputField[] {
  if (!definition || typeof definition !== "object") return [];
  const root = definition as Record<string, unknown>;
  const steps = Array.isArray(root.steps) ? root.steps : Object.values(root);
  const seen = new Set<string>();
  const fields: RunInputField[] = [];
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const stepRec = step as Record<string, unknown>;
    if (!USER_INPUT_TYPE.test(String(stepRec.type ?? ""))) continue;
    // Preferred: backend outputs { name: { type } }.
    if (stepRec.outputs && typeof stepRec.outputs === "object") {
      for (const [name, spec] of Object.entries(stepRec.outputs as Record<string, unknown>)) {
        if (seen.has(name)) continue;
        seen.add(name);
        fields.push({ name, type: fieldType(spec) });
      }
      continue;
    }
    // Legacy: inputs/fields name map (all text). Values may be specs or raw.
    const legacy = stepRec.inputs ?? stepRec.fields;
    if (legacy && typeof legacy === "object") {
      for (const [name, spec] of Object.entries(legacy as Record<string, unknown>)) {
        if (seen.has(name)) continue;
        seen.add(name);
        fields.push({ name, type: fieldType(spec) });
      }
    }
  }
  return fields;
}

/** Back-compat shim: names only, for callers that previously consumed `string[]`. */
export function inputFields(definition: unknown): string[] {
  return extractInputFields(definition).map((field) => field.name);
}
