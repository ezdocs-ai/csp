/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";
import type { GarmentSlot } from "../types";

type VtoState = { personAssetId: string; garments: Partial<Record<GarmentSlot, string>> };

export function useVtoState() {
  const [state, setState] = useState<VtoState>({ personAssetId: "", garments: {} });
  return {
    state,
    setPersonAsset: (personAssetId: string) => setState((current) => ({ ...current, personAssetId })),
    setGarment: (slot: GarmentSlot, assetId: string) => setState((current) => ({ ...current, garments: { ...current.garments, [slot]: assetId } })),
  };
}
