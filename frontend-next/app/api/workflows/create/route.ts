/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";
import { workflowDraftToCreateDto } from "@/src/features/workflow-editor/mapper";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Workflow name is required" }, { status: 400 });
  try {
    // WorkflowCreateDto = {name, description?, steps[]}; strip the UI `definition` wrapper.
    const dto = workflowDraftToCreateDto(body);
    return NextResponse.json(await (await requireApiClient()).post("/api/workflows", JSON.stringify(dto)));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow create failed" }, { status });
  }
}
