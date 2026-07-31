/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  await requireRole(["admin"]);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await (await requireApiClient()).post(`/api/admin/ai-providers/${encodeURIComponent(id)}/test`));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider test failed" }, { status });
  }
}
