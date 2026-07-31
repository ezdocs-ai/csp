/** Copyright 2026 Google LLC — Apache-2.0 */

import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined))
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.workspaceId) || !body.generationModel)
    return NextResponse.json({ error: "workspaceId and generationModel required" }, { status: 400 });
  try {
    const api = await requireApiClient();
    const item = await api.post<{ id?: string; mediaItemId?: string } & Record<string, unknown>>(
      "/api/videos/generate-videos",
      JSON.stringify(body),
    );
    return NextResponse.json({ mediaItemId: item?.id ?? item?.mediaItemId, ...item }, { status: 202 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video generation failed" }, { status });
  }
}
