/** Copyright 2026 Google LLC — Apache-2.0
 * Pure helpers mapping a picked SourceAsset to a workflow image input value.
 *
 * Backend image arg union accepts a bare int sourceAssetId (audit mem H7). The
 * React picker surface stores the resolved int + display metadata (name/
 * preview); submission reduces back to the bare int. Never reads image bytes. */
import type { SourceAsset } from "@/src/features/source-assets/types";

export type SelectedImage = { id: number; name: string; previewUrl?: string };

/** Map a picked asset to the stored selection (id coerced to int). */
export function toSelectedImage(asset: SourceAsset): SelectedImage {
  return { id: Number(asset.id), name: asset.name, previewUrl: asset.thumbnailUrl ?? asset.url };
}

/** Reduce image-field selections to the submission payload: a bare int
 * sourceAssetId per selected field. Unselected / non-integer ids are omitted
 * (parity with the previous empty-number-input behaviour). */
export function selectionsToInputs(
  selections: Readonly<Record<string, SelectedImage>>,
  fieldNames: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of fieldNames) {
    const id = selections[name]?.id;
    if (Number.isInteger(id)) out[name] = id;
  }
  return out;
}
