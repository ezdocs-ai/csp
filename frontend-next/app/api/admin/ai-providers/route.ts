/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function GET() {
  await requireRole(["admin"]);
  try {
    return NextResponse.json(await (await requireApiClient()).get("/api/admin/ai-providers"));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider list failed" }, { status });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.key || !body?.displayName || !body?.providerType) {
    return NextResponse.json({ error: "key, displayName and providerType required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await (await requireApiClient()).post("/api/admin/ai-providers", JSON.stringify(body)), { status: 201 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider create failed" }, { status });
  }
}
