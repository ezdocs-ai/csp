/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
  const message = error instanceof Error ? error.message : "Failed to load workspace";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const api = await requireApiClient();
    const workspace = await api.get(`/api/workspaces/${encodeURIComponent(id)}`);
    return NextResponse.json(workspace);
  } catch (error) {
    return errorResponse(error);
  }
}
