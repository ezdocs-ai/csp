/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined))
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.targetType !== "string" || typeof body.userPrompt !== "string")
    return NextResponse.json({ error: "targetType and userPrompt required" }, { status: 400 });
  try {
    const item = await (await requireApiClient()).post<{ prompt?: string }>(
      "/api/gemini/rewrite-prompt",
      JSON.stringify(body),
    );
    return NextResponse.json(item);
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prompt rewrite failed" }, { status });
  }
}
