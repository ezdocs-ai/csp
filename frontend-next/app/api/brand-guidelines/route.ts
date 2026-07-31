/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
  const message = error instanceof Error ? error.message : "Brand guideline request failed";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  try {
    const api = await requireApiClient();
    const guideline = await api.get(`/api/brand-guidelines/workspace/${encodeURIComponent(workspaceId)}`);
    return NextResponse.json(guideline);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.action) return NextResponse.json({ error: "Action required" }, { status: 400 });

  const paths = {
    "generate-upload-url": "/api/brand-guidelines/generate-upload-url",
    "finalize-upload": "/api/brand-guidelines/finalize-upload",
  } as const;
  const path = paths[body.action as keyof typeof paths];
  if (!path) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const payload = { ...body };
  delete payload.action;
  try {
    const api = await requireApiClient();
    const result = await api.post(path, JSON.stringify(payload));
    return NextResponse.json(result, { status: body.action === "finalize-upload" ? 202 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
