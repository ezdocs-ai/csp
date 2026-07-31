/** Copyright 2026 Google LLC — Apache-2.0 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";
import { buildUpscaleFormData } from "@/src/features/upscale/types";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.workspaceId) || body.workspaceId < 1 || ![2, 4].includes(body.factor) || (typeof body.sourceAssetId !== "string" && typeof body.mediaItemId !== "string")) return NextResponse.json({ error: "workspaceId, source asset or media item, and factor required" }, { status: 400 });
  try {
    // upload-upscale (multipart Form) is the source-asset upscale contract;
    // upscale-image (JSON UpscaleImagenDto) needs a gcs_uri/base64 user_image.
    const result = await (await requireApiClient()).post<{ id?: number | string } & Record<string, unknown>>("/api/images/upload-upscale", buildUpscaleFormData(body));
    if (result.id === undefined || result.id === null) return NextResponse.json({ error: "Upscale job ID missing" }, { status: 502 });
    return NextResponse.json({ mediaItemId: String(result.id) }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upscale failed" }, { status: typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500 });
  }
}
