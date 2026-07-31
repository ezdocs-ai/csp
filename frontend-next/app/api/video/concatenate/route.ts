/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.workspaceId) || !Array.isArray(body.mediaItemIds) || body.mediaItemIds.length < 2 || !body.mediaItemIds.every(Number.isInteger)) return NextResponse.json({ error: "workspaceId and at least two mediaItemIds required" }, { status: 400 });
  const payload = { workspace_id: body.workspaceId, inputs: body.mediaItemIds.map((id: number) => ({ id, type: "media_item" })), name: body.name ?? "Concatenated Video" };
  try {
    const item = await (await requireApiClient()).post<Record<string, unknown>>("/api/videos/concatenate", JSON.stringify(payload));
    return NextResponse.json({ mediaItemId: item.id ?? item.mediaItemId, ...item }, { status: 202 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video concatenate failed" }, { status });
  }
}
