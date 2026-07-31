/** Copyright 2026 Google LLC — Apache-2.0 */
export type GarmentSlot = "top" | "bottom" | "dress" | "shoes";
export type VtoRequest = { workspaceId: number; personAssetId: string; garments: { slot: GarmentSlot; assetId: string }[] };
export type VtoResponse = { mediaItemId: string };

/* --- Additive (Angular VTO stepper model) --- */

/** Angular `firstFormGroup.modelType`. Default "female" (Angular default). */
export type Gender = "female" | "male";

/** Preset model/garment card sourced from `/api/source-assets?type=<assetType>`. */
export type PresetAsset = {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
};

/** Backend `AssetTypeEnum` values for VTO preset categories. */
export type VtoPresetCategory =
  | "vto_person_female"
  | "vto_person_male"
  | "vto_top"
  | "vto_bottom"
  | "vto_dress"
  | "vto_shoe";

/**
 * Linear stepper step-1 validity (Angular `firstFormGroup.valid`): a gender is
 * chosen AND a model (preset or uploaded) is selected.
 */
export function isStepOneValid(gender: Gender | "", personAssetId: string): boolean {
  return gender !== "" && personAssetId !== "";
}
