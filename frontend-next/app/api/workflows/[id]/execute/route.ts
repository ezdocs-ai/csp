/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";
import { executionResponseToUi, toExecuteArgs } from "@/src/features/workflow-run/mapper";
import type { ExecutionResponseDto } from "@/src/features/workflow-run/types";

// workspace_id is client-resolved; accept it from body, header, or query.
function readWorkspaceId(request: NextRequest, body: unknown): number | null {
  const raw =
    (body as { workspaceId?: unknown })?.workspaceId ??
    request.headers.get("x-workspace-id") ??
    request.nextUrl.searchParams.get("workspaceId");
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const workspaceId = readWorkspaceId(request, body);
    // Accept either {args} (already-correct) or {inputs} (legacy client shape); wrap as {args} + workspace_id.
    const source = body.args && typeof body.args === "object" ? body.args : body.inputs && typeof body.inputs === "object" ? body.inputs : {};
    const response = await (await requireApiClient()).post<ExecutionResponseDto>(
      `/api/workflows/${encodeURIComponent(id)}/workflow-execute`,
      JSON.stringify({ args: toExecuteArgs(source, workspaceId) }),
    );
    return NextResponse.json(executionResponseToUi(response, id), { status: 202 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow execute failed" }, { status });
  }
}
