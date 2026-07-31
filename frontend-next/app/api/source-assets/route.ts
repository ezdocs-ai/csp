/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Source asset request failed" }, { status });
}

type BackendAsset = Record<string, unknown> & {
  id?: string | number;
  originalFilename?: string;
  mimeType?: string;
  presignedUrl?: string;
  presignedOriginalUrl?: string;
  presignedThumbnailUrl?: string;
};

function normalizeAsset(asset: BackendAsset) {
  const mimeType = typeof asset.mimeType === "string" ? asset.mimeType : "";
  const type = mimeType.startsWith("video/")
    ? "video"
    : mimeType.startsWith("audio/")
      ? "audio"
      : "image";
  return {
    ...asset,
    id: String(asset.id ?? ""),
    name: asset.originalFilename ?? "Untitled asset",
    type,
    url: asset.presignedUrl ?? asset.presignedOriginalUrl,
    thumbnailUrl: asset.presignedThumbnailUrl || asset.presignedUrl,
  };
}

export async function GET(request: NextRequest) {
  try {
    const api = await requireApiClient();
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type");
    const search = sp.get("search");
    const scope = sp.get("scope");
    const assetType = sp.get("asset_type");
    const workspaceId = sp.get("workspace_id");
    const userEmail = sp.get("user_email");
    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? "50") || 50));
    const body: Record<string, unknown> = { limit, offset: (page - 1) * limit };
    if (type === "image" || type === "video" || type === "audio") body.mime_type = `${type}/*`;
    if (search) body.original_filename = search;
    // Admin-only filters (backend clears these for non-admin callers). Forwarded
    // verbatim so the admin browse journey can scope by type/owner/workspace.
    if (scope) body.scope = scope;
    if (assetType) body.asset_type = assetType;
    if (workspaceId) body.workspace_id = Number(workspaceId);
    if (userEmail) body.user_email = userEmail;
    const result = await api.post<{ data?: BackendAsset[] } & Record<string, unknown>>("/api/source_assets/search", JSON.stringify(body));
    return NextResponse.json({ ...result, data: (result.data ?? []).map(normalizeAsset) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const formData = await request.formData();
    if (!(formData.get("file") instanceof File) || !formData.get("workspaceId")) return NextResponse.json({ error: "file and workspaceId required" }, { status: 400 });
    const api = await requireApiClient();
    const asset = await api.post<BackendAsset>("/api/source_assets/upload", formData);
    return NextResponse.json(normalizeAsset(asset), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
