/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";

import { AssetPicker } from "@/src/components/media";
import { Button } from "@/src/components/ui";
import type { SourceAsset } from "@/src/features/source-assets/types";
import type { RunInputField } from "@/src/features/workflows/components/extract-input-fields";
import { toSelectedImage, type SelectedImage } from "../workflow-image-selection";

type Props = {
  imageFields: RunInputField[];
  value: Record<string, SelectedImage>;
  onChange: (next: Record<string, SelectedImage>) => void;
};

/** Single-image source-asset picker for workflow user_input image fields.
 * Stores the resolved integer sourceAssetId + display metadata; never reads
 * image bytes. Shared by RunWorkflowModal and RunPanel single-run tab. */
export function WorkflowImageInputs({ imageFields, value, onChange }: Props) {
  const [openField, setOpenField] = useState<string | null>(null);
  if (!imageFields.length) return null;
  const clear = (name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  };
  return (
    <fieldset className="grid gap-[var(--tri-space-3)]">
      <legend className="text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">Image inputs</legend>
      {imageFields.map((field) => {
        const selection = value[field.name];
        return (
          <div className="grid gap-[var(--tri-space-2)]" key={field.name}>
            <span className="text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)]">{field.name}</span>
            {selection ? (
              <div className="flex items-center gap-[var(--tri-space-3)]">
                {selection.previewUrl ? (
                  // Signed URLs must bypass Next image optimization.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="size-12 rounded-[var(--tri-radius-md)] object-cover" src={selection.previewUrl} />
                ) : (
                  <div className="size-12 rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)]" />
                )}
                <span className="truncate text-[length:var(--tri-text-small-size)]">{selection.name} (#{selection.id})</span>
                <Button aria-label={`Change image for ${field.name}`} onClick={() => setOpenField(field.name)} variant="secondary">Change</Button>
                <Button aria-label={`Clear image for ${field.name}`} onClick={() => clear(field.name)} variant="secondary">Clear</Button>
              </div>
            ) : (
              <Button aria-label={`Select image for ${field.name}`} onClick={() => setOpenField(field.name)} variant="secondary">Select image</Button>
            )}
          </div>
        );
      })}
      {openField ? (
        <AssetPicker
          multiple={false}
          onClose={() => setOpenField(null)}
          onselect={(assets: SourceAsset[]) => {
            const asset = assets[0];
            if (asset) onChange({ ...value, [openField]: toSelectedImage(asset) });
          }}
          type="image"
        />
      ) : null}
    </fieldset>
  );
}
