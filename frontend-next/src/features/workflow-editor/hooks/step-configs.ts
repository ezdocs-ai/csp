/** Copyright 2026 Google LLC — Apache-2.0
 * Per-step-type required inputs/settings contract for the backend WorkflowStep
 * discriminated union (backend: src/workflows/schema/workflow_model.py).
 *
 * Source of truth for the editor's per-step config capture and for the
 * mapper.toBackendStep enrichment. Mirrors the Angular step-configs defaults
 * (frontend/.../workflow-editor/step-components/step-configs/*.config.ts).
 */
import type { StepType } from "../types";

export type ConfigBucket = "inputs" | "settings";
export type ConfigKind = "text" | "textarea" | "number" | "select" | "checkbox" | "ref" | "ref-list";
export type RefType = "image" | "video" | "audio" | "text";
/** Narrow ref-list capability tag. Only "image-ingredients" ref-lists are
 *  model-gated (Ingredients-to-Image, Gemini image models); generic ref-lists
 *  stay visible/unlimited. Extend this union when a new gate is needed. */
export type RefListCapability = "image-ingredients";

export interface StepFieldSpec {
  name: string;
  label: string;
  bucket: ConfigBucket;
  kind: ConfigKind;
  default: string | number | boolean | BackendInputRef[];
  options?: string[];
  required?: boolean;
  /** For kind:"ref" / kind:"ref-list" — the output type this input consumes
   *  from a prior step. Also set on acceptsRef text/textarea prompt fields
   *  (the type a whole-value ref points to). */
  refType?: RefType;
  /** text/textarea field that ALSO accepts one whole-value StepOutputReference
   *  (prompt templating). Coerced idempotently: a structured BackendInputRef
   *  stays an object; a literal stays a string. The legacy linear form and the
   *  canvas read prompts by `kind` (text/textarea), so this is additive. */
  acceptsRef?: boolean;
  /** Ref-list capability tag. Only tagged ref-lists are model-gated; generic
   *  ref-lists are always visible/unlimited (see isModelGatedRefList). */
  refListCapability?: RefListCapability;
}

export interface StepOutputSpec {
  name: string;
  type: RefType;
}

export type ConfigValues = Record<string, string | number | boolean | BackendInputRef | BackendInputRef[]>;

export type BackendInputRef = { step: string; output: string };
export type BackendInputValue = string | number | boolean | BackendInputRef | BackendInputRef[];
export type BackendStepConfig = { inputs: Record<string, BackendInputValue>; settings: Record<string, BackendInputValue> };

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

/** Field specs per UI short step type. Drives both the capture form and the builder.
 *
 *  Field name == React Flow handle id (base-workflow-node renders one <Handle>
 *  per ref/ref-list field with id={field.name}); keep names unique within a type.
 *  Backend field names are exact (workflow_model.py): omitting/renaming a key
 *  breaks the strict discriminated Pydantic models. */
export const STEP_FIELDS: Record<StepType, StepFieldSpec[]> = {
  "user-input": [],
  text: [
    { name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "", required: true, acceptsRef: true, refType: "text" },
    // Generic multi-reference fan-in (Gemini multimodal text). Not model-gated.
    { name: "input_images", label: "Input images", bucket: "inputs", kind: "ref-list", default: [], refType: "image" },
    { name: "input_videos", label: "Input videos", bucket: "inputs", kind: "ref-list", default: [], refType: "video" },
    { name: "model", label: "Model", bucket: "settings", kind: "text", default: "gemini-3-flash-preview" },
    { name: "temperature", label: "Temperature", bucket: "settings", kind: "number", default: 0.7 },
  ],
  image: [
    { name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "", required: true, acceptsRef: true, refType: "text" },
    // Ingredients / Reference images: ordered multi-reference fan-in, capability-gated
    // per model via modelSupportsImageReferences / maxImageInputsForModel (image-ingredients).
    // Required:false + empty-list omission keeps strict backend models happy for unsupported models.
    { name: "input_images", label: "Ingredients / Reference images", bucket: "inputs", kind: "ref-list", default: [], refType: "image", refListCapability: "image-ingredients" },
    { name: "model", label: "Model", bucket: "settings", kind: "text", default: "gemini-3.1-flash-image" },
    { name: "aspect_ratio", label: "Aspect ratio", bucket: "settings", kind: "select", default: "1:1", options: ASPECT_RATIOS },
    { name: "brand_guidelines", label: "Use brand guidelines", bucket: "settings", kind: "checkbox", default: false },
  ],
  edit: [
    // Required ref-list image (backend EditImageInputs.input_images). Gemini image
    // edit is multi-image, so it carries the image-ingredients capability gate.
    { name: "input_images", label: "Input images (from prior steps)", bucket: "inputs", kind: "ref-list", default: [], refType: "image", required: true, refListCapability: "image-ingredients" },
    { name: "prompt", label: "Edit prompt", bucket: "inputs", kind: "textarea", default: "", required: true, acceptsRef: true, refType: "text" },
    { name: "model", label: "Model", bucket: "settings", kind: "text", default: "gemini-2.5-flash-image" },
    { name: "aspect_ratio", label: "Aspect ratio", bucket: "settings", kind: "select", default: "1:1", options: ASPECT_RATIOS },
    { name: "brand_guidelines", label: "Use brand guidelines", bucket: "settings", kind: "checkbox", default: false },
  ],
  video: [
    { name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "", required: true, acceptsRef: true, refType: "text" },
    // Image-to-video reference set (Veo). Generic ref-list, not Ingredients-gated.
    { name: "input_images", label: "Input images", bucket: "inputs", kind: "ref-list", default: [], refType: "image" },
    { name: "start_frame", label: "Start frame (from a prior step)", bucket: "inputs", kind: "ref", default: "", refType: "image" },
    { name: "end_frame", label: "End frame (from a prior step)", bucket: "inputs", kind: "ref", default: "", refType: "image" },
    { name: "model", label: "Model", bucket: "settings", kind: "text", default: "veo-3.0-generate-001" },
    { name: "aspect_ratio", label: "Aspect ratio", bucket: "settings", kind: "select", default: "16:9", options: ASPECT_RATIOS },
    { name: "brand_guidelines", label: "Use brand guidelines", bucket: "settings", kind: "checkbox", default: false },
  ],
  vto: [
    { name: "model_image", label: "Model image (from a prior step)", bucket: "inputs", kind: "ref", default: "", refType: "image", required: true },
    { name: "top_image", label: "Top (from a prior step)", bucket: "inputs", kind: "ref", default: "", refType: "image" },
    { name: "bottom_image", label: "Bottom (from a prior step)", bucket: "inputs", kind: "ref", default: "", refType: "image" },
    { name: "dress_image", label: "Dress (from a prior step)", bucket: "inputs", kind: "ref", default: "", refType: "image" },
    { name: "shoes_image", label: "Shoes (from a prior step)", bucket: "inputs", kind: "ref", default: "", refType: "image" },
  ],
  audio: [
    { name: "prompt", label: "Prompt", bucket: "inputs", kind: "textarea", default: "", required: true, acceptsRef: true, refType: "text" },
    { name: "model", label: "Model", bucket: "settings", kind: "text", default: "lyria-002" },
  ],
};

/** Static outputs each step type produces (used to populate ref dropdowns). user-input is dynamic. */
export const STEP_OUTPUTS: Record<StepType, StepOutputSpec[]> = {
  "user-input": [],
  text: [{ name: "generated_text", type: "text" }],
  image: [{ name: "generated_image", type: "image" }],
  edit: [{ name: "edited_image", type: "image" }],
  video: [{ name: "generated_video", type: "video" }],
  vto: [{ name: "generated_image", type: "image" }],
  audio: [{ name: "generated_audio", type: "audio" }],
};

/** Default form values for a freshly added step of `type`. */
export function defaultStepConfig(type: StepType): ConfigValues {
  const values: ConfigValues = {};
  for (const field of STEP_FIELDS[type]) values[field.name] = field.default;
  return values;
}

/** True only for ref-lists whose target-handle visibility is model-gated.
 *  Generic ref-lists (text/video image+video fan-in) are NOT gated — they stay
 *  visible/unlimited. Canvas adopter (base-workflow-node.isRefListVisible) should
 *  read this instead of gating every ref-list. */
export function isModelGatedRefList(field: StepFieldSpec): boolean {
  return field.kind === "ref-list" && field.refListCapability === "image-ingredients";
}

/** Ref-list visibility resolver: a ref-list is hidden only when it is a
 *  model-gated (image-ingredients) ref-list whose selected model lacks the
 *  capability. Non-ref-list fields and generic ref-lists are always visible. */
export function refListVisibleFor(field: StepFieldSpec, model: string | undefined | null): boolean {
  if (field.kind !== "ref-list") return true;
  if (!isModelGatedRefList(field)) return true;
  return modelSupportsImageReferences(model);
}

/** Ref values are stored as "stepId::output"; parse to a backend StepOutputReference. */
export function parseRef(raw: string): BackendInputRef | null {
  const sep = raw.indexOf("::");
  if (sep <= 0) return null;
  const step = raw.slice(0, sep);
  const output = raw.slice(sep + 2);
  return step && output ? { step, output } : null;
}

/** Coerce one ref value (string "stepId::output" or already-resolved object) to a BackendInputRef. */
export function parseRefItem(raw: unknown): BackendInputRef | null {
  if (typeof raw === "object" && raw !== null && "step" in raw && "output" in raw) {
    const r = raw as { step: unknown; output: unknown };
    if (typeof r.step === "string" && typeof r.output === "string") return { step: r.step, output: r.output };
  }
  return typeof raw === "string" ? parseRef(raw) : null;
}

/** Coerce a ref-list value (array of refs/strings, or a single ref/string) to an ordered BackendInputRef[]. */
export function parseRefList(raw: unknown): BackendInputRef[] {
  const items = Array.isArray(raw) ? raw : [raw];
  const refs: BackendInputRef[] = [];
  for (const item of items) {
    const ref = parseRefItem(item);
    if (ref) refs.push(ref);
  }
  return refs;
}

/**
 * Interim model-key capability map for ordered multi-reference Ingredients-to-Image
 * (the image/edit step's `input_images` ref-list). Mirrors backend
 * `GenerationModelEnum.is_gemini_image_model` + `max_total_inputs`
 * (backend/src/common/base_dto.py) and the executor capability gate
 * (`WorkflowsExecutorService._validate_image_input_capability`). Each supported
 * model advertises its own per-provider limit; no global maximum is hardcoded.
 *
 * INTERIM contract — follow-up required: backend capability metadata does not yet
 * ship to the frontend (no BFF route or ai-models field exposes multi-image
 * capability/limit), so this map is the narrow tested source the editor exposes.
 * When the BFF/ai-models surface advertises capability, replace this constant with
 * a resolver that reads server-provided `ModelCapability`
 * (frontend-next/src/features/workflow-canvas/graph-types.ts) and delete these
 * keys. Do NOT add model keys speculatively: the executor rejects any model that
 * is not `is_gemini_image_model`, so the map must stay in lockstep with that enum.
 */
export const MODEL_IMAGE_INPUT_CAPABILITIES: ReadonlyMap<string, number> = new Map([
  ["gemini-2.5-flash-image-preview", 2],
  ["gemini-2.5-flash-image", 2],
  ["gemini-3-pro-image-preview", 14],
  ["gemini-3-pro-image", 14],
  ["gemini-3.1-flash-image-preview", 14],
  ["gemini-3.1-flash-image", 14],
  ["gemini-3.1-flash-lite-image", 14],
]);

/** Max ordered reference images a model accepts (Ingredients-to-Image). 0 = unsupported. */
export function maxImageInputsForModel(model: string | undefined | null): number {
  return model ? MODEL_IMAGE_INPUT_CAPABILITIES.get(model) ?? 0 : 0;
}

/** True when `model` advertises ordered multi-image reference input (Ingredients-to-Image). */
export function modelSupportsImageReferences(model: string | undefined | null): boolean {
  return maxImageInputsForModel(model) > 0;
}

function coerce(field: StepFieldSpec, raw: ConfigValues[string]): BackendInputValue {
  if (field.kind === "checkbox") return Boolean(raw);
  if (field.kind === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : field.default;
  }
  if (field.kind === "ref-list") return parseRefList(raw);
  if (field.kind === "ref") {
    // Idempotent: accept already-resolved ref objects or "stepId::output" strings.
    return parseRefItem(raw) ?? "";
  }
  if (field.acceptsRef) {
    // Literal-or-ref (prompt templating): keep a structured BackendInputRef as an
    // object (round-trip from backend stays structured); otherwise keep the literal
    // string. Idempotent across repeated builds.
    return parseRefItem(raw) ?? (typeof raw === "string" ? raw : String(raw));
  }
  return typeof raw === "string" ? raw : String(raw);
}

/**
 * Build the backend {inputs, settings} object for a step type from captured
 * form values. Only emits fields declared in STEP_FIELDS, so no stray keys
 * reach the strict backend models. Empty OPTIONAL ref / ref-list fields are
 * omitted so strict backend models never see an empty string / empty list.
 */
export function buildBackendStepConfig(type: StepType, values: ConfigValues): BackendStepConfig {
  const inputs: Record<string, BackendInputValue> = {};
  const settings: Record<string, BackendInputValue> = {};
  for (const field of STEP_FIELDS[type]) {
    const value = coerce(field, values[field.name] ?? field.default);
    if (field.kind === "ref-list" && Array.isArray(value) && value.length === 0 && !field.required) continue;
    if (field.kind === "ref" && value === "" && !field.required) continue;
    const target = field.bucket === "inputs" ? inputs : settings;
    target[field.name] = value;
  }
  return { inputs, settings };
}

/** Human labels of required fields that are empty/missing — blocks save rather than sending an invalid payload.
 *  A required ref needs a valid ref; a required acceptsRef field is satisfied by a nonblank literal OR a valid ref. */
export function missingRequired(type: StepType, values: ConfigValues): string[] {
  const missing: string[] = [];
  for (const field of STEP_FIELDS[type]) {
    if (!field.required) continue;
    const raw = values[field.name];
    if (field.kind === "ref-list") {
      if (parseRefList(raw).length === 0) missing.push(field.label);
    } else if (field.kind === "ref") {
      if (!parseRefItem(raw)) missing.push(field.label);
    } else if (field.acceptsRef) {
      if (!parseRefItem(raw) && (typeof raw !== "string" || raw.trim() === "")) missing.push(field.label);
    } else if (typeof raw !== "string" || raw.trim() === "") {
      missing.push(field.label);
    }
  }
  return missing;
}
