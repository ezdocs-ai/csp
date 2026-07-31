/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";
import { batchResponseToUi, executionResponseToUi, toBatchRequest, toExecuteArgs } from "@/src/features/workflow-run/mapper";
import type { BatchExecutionResponseDto, ExecutionResponseDto } from "@/src/features/workflow-run/types";

// workspace_id is client-resolved (no server workspace session); accept it from body, header, or query.
function readWorkspaceId(request: NextRequest, body: unknown): number | null {
  const raw =
    (body as { workspaceId?: unknown })?.workspaceId ??
    request.headers.get("x-workspace-id") ??
    request.nextUrl.searchParams.get("workspaceId");
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const { id } = await params;
    const client = await requireApiClient();
    const workspaceId = readWorkspaceId(request, body);

    // Batch -> dedicated /batch-execute with {items:[{row_index, args}]} (workspace_id injected per row).
    if (Array.isArray(body.batch)) {
      const response = await client.post<BatchExecutionResponseDto>(
        `/api/workflows/${encodeURIComponent(id)}/batch-execute`,
        JSON.stringify(toBatchRequest(body.batch, workspaceId)),
      );
      return NextResponse.json(batchResponseToUi(response, id), { status: 202 });
    }

    // Single -> /workflow-execute with {args} (workspace_id injected).
    const inputs = body.inputs && typeof body.inputs === "object" ? (body.inputs as Record<string, unknown>) : {};
    const response = await client.post<ExecutionResponseDto>(
      `/api/workflows/${encodeURIComponent(id)}/workflow-execute`,
      JSON.stringify({ args: toExecuteArgs(inputs, workspaceId) }),
    );
    return NextResponse.json(executionResponseToUi(response, id), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow run failed" }, { status: statusOf(error) });
  }
}
