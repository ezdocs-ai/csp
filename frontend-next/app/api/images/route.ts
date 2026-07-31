/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("options") !== "1") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(await (await requireApiClient()).get("/api/options/image-generation"));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image options failed" }, { status });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim() || !Number.isInteger(body.workspaceId) || body.workspaceId < 1) return NextResponse.json({ error: "Prompt and workspaceId required" }, { status: 400 });
  try {
    // `mode` and `referenceImages` are client-only UI state (FlowPromptBox mode
    // selector / ReferenceMediaStrip); CreateImagenDto has additionalProperties:
    // false and rejects unknown fields, so strip them before forwarding.
    const backendBody = { ...body };
    delete backendBody.mode;
    delete backendBody.referenceImages;
    const item = await (await requireApiClient()).post<{ id?: string; mediaItemId?: string } & Record<string, unknown>>("/api/images/generate-images", JSON.stringify({ ...backendBody, prompt: body.prompt.trim() }));
    return NextResponse.json({ mediaItemId: item?.id ?? item?.mediaItemId, ...item }, { status: 202 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image generation failed" }, { status });
  }
}
