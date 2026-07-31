/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

// Frontend GarmentSlot -> backend VtoDto field suffix. "shoes" (plural slot)
// maps to singular "shoe_image"; VtoDto uses extra="forbid", so a wrong key
// (e.g. shoes_image) triggers a 422 and drops the garment.
const GARMENT_IMAGE_FIELD: Record<string, string> = { top: "top", bottom: "bottom", dress: "dress", shoes: "shoe" };

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.workspaceId) || body.workspaceId < 1 || typeof body.personAssetId !== "string" || !body.personAssetId || !Array.isArray(body.garments) || !body.garments.length || body.garments.some((garment: { slot?: string; assetId?: unknown }) => !["top", "bottom", "dress", "shoes"].includes(garment?.slot ?? "") || typeof garment.assetId !== "string" || !garment.assetId)) return NextResponse.json({ error: "Workspace, person, and garment required" }, { status: 400 });
  const garments = Object.fromEntries(body.garments.map((garment: { slot: string; assetId: string }) => [`${GARMENT_IMAGE_FIELD[garment.slot]}_image`, { source_asset_id: Number(garment.assetId) }]));
  if (!Number.isInteger(Number(body.personAssetId)) || Object.values(garments).some((input) => !Number.isInteger((input as { source_asset_id: number }).source_asset_id))) return NextResponse.json({ error: "Asset IDs must be integers" }, { status: 400 });
  try {
    const item = await (await requireApiClient()).post<{ id?: string; mediaItemId?: string } & Record<string, unknown>>("/api/images/generate-images-for-vto", JSON.stringify({ workspace_id: body.workspaceId, person_image: { source_asset_id: Number(body.personAssetId) }, ...garments }));
    return NextResponse.json({ mediaItemId: item?.id ?? item?.mediaItemId, ...item }, { status: 202 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "VTO generation failed" }, { status });
  }
}
