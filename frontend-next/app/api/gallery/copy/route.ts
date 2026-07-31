/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.mediaIds) || typeof body?.workspaceId !== "string") return NextResponse.json({ error: "mediaIds and workspaceId required" }, { status: 400 });
  try { return NextResponse.json(await (await requireApiClient()).post("/api/gallery/bulk-copy", JSON.stringify(body))); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Copy failed" }, { status: typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500 }); }
}
