/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export const maxDuration = 600;

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined))
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.clips) || typeof body.output_format !== "string")
    return NextResponse.json({ error: "clips and output_format required" }, { status: 400 });
  try {
    const api = await requireApiClient();
    const blob = await api.postBlob("/api/workbench/render", JSON.stringify(body), { signal: AbortSignal.timeout(10 * 60 * 1000) });
    return new NextResponse(blob, { headers: { "content-type": blob.type || "video/mp4", "content-disposition": `attachment; filename="workbench.${body.output_format}"`, "x-content-type-options": "nosniff" } });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render failed" }, { status });
  }
}
