/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Source asset request failed" }, { status });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await (await requireApiClient()).get(`/api/source_assets/${encodeURIComponent(id)}`));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const { id } = await params;
    await (await requireApiClient()).delete(`/api/source_assets/${encodeURIComponent(id)}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  return NextResponse.json({ error: "Metadata updates are not supported by backend" }, { status: 501 });
}
