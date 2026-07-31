/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
  const message = error instanceof Error ? error.message : "Failed to invite member";
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const api = await requireApiClient();
    const invite = await api.post(
      `/api/workspaces/${encodeURIComponent(id)}/invites`,
      JSON.stringify({ email: body.email.trim(), role: body.role ?? "viewer" }),
    );
    return NextResponse.json(invite);
  } catch (error) {
    return errorResponse(error);
  }
}
