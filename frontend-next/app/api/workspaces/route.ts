/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function GET() {
  try {
    const api = await requireApiClient();
    return NextResponse.json(await api.get("/api/workspaces"));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list workspaces" }, { status });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const api = await requireApiClient();
    const workspace = await api.post("/api/workspaces", JSON.stringify({ name: body.name.trim() }));
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create workspace" }, { status });
  }
}
