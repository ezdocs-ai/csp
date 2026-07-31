/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  await requireRole(["admin"]);
  const { id } = await params;
  try {
    return NextResponse.json(await (await requireApiClient()).get(`/api/admin/ai-models/${encodeURIComponent(id)}`));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Model fetch failed" }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await (await requireApiClient()).patch(`/api/admin/ai-models/${encodeURIComponent(id)}`, JSON.stringify(body)));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Model update failed" }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await (await requireApiClient()).delete(`/api/admin/ai-models/${encodeURIComponent(id)}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Model delete failed" }, { status });
  }
}
