/** Copyright 2026 Google LLC — Apache-2.0 */

/**
 * Pure parser for the cross-feature remix handoff the gallery stages under
 * sessionStorage `"remixState"` before routing to `/vto`
 * (writers: `gallery-actions.ts` `buildSendToVto` + image-studio
 * `handleSendToVto`).
 *
 * The `/vto` receiver reads that key ONCE on mount, deferred past hydration
 * (see `vto-studio.tsx`), then hydrates the model person source
 * (`setPersonAsset` / `setPersonPreviewUrl` / `setPersonIsUpload`). VTO has no
 * template initialState, so the handoff always applies.
 *
 * Pure (no storage access) → SSR-safe and unit testable without a DOM.
 */
export const REMIX_STATE_KEY = "remixState";

/** Recognized remixState fields for the `/vto` model-image receiver. */
export type VtoRemixIntent = {
  /** Gallery media id used as the person asset id (matches image-studio writer). */
  modelImageAssetId: number;
  modelImagePreviewUrl?: string;
  modelImageMediaIndex?: number;
  modelImageGcsUri?: string;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

/**
 * Validate a raw sessionStorage payload and extract ONLY recognized fields.
 * Returns `null` unless the object carries a numeric `modelImageAssetId`
 * (the one field the VTO person source requires).
 */
export function parseVtoRemix(raw: unknown): VtoRemixIntent | null {
  if (!isObj(raw)) return null;
  const { modelImageAssetId, modelImagePreviewUrl, modelImageMediaIndex, modelImageGcsUri } = raw;
  if (!isNum(modelImageAssetId)) return null;

  const intent: VtoRemixIntent = { modelImageAssetId };
  if (isStr(modelImagePreviewUrl)) intent.modelImagePreviewUrl = modelImagePreviewUrl;
  if (isNum(modelImageMediaIndex)) intent.modelImageMediaIndex = modelImageMediaIndex;
  if (isStr(modelImageGcsUri)) intent.modelImageGcsUri = modelImageGcsUri;
  return intent;
}
