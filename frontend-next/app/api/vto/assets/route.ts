/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";

// Forwards to backend GET /api/source_assets/vto-assets (VtoAssetsResponseDto).
// Frontend VTO caller cannot reach backend's underscore-prefixed path directly
// (lead's Next BFF exposes /api/source-assets hyphen-only and has no vto-assets
// sub-route). Response shape passes through unchanged: top-level snake_case keys
// (female_models, tops, ...) with camelCase nested asset fields matching the
// frontend VtoAssetDto/mapAsset contract — no normalization required.
// No CSRF: idempotent authenticated GET, consistent with /api/vto/[id] polling.
export async function GET() {
  try {
    const data = await (await requireApiClient()).get<Record<string, unknown>>("/api/source_assets/vto-assets");
    return NextResponse.json(data);
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "VTO assets fetch failed" }, { status });
  }
}
