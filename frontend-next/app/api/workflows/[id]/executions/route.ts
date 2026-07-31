/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Forward supported query params to the backend executions listing.
    const query = new URLSearchParams();
    for (const key of ["limit", "page_token", "status"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const qs = query.toString();
    return NextResponse.json(await (await requireApiClient()).get(`/api/workflows/${encodeURIComponent(id)}/executions${qs ? `?${qs}` : ""}`));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow executions failed" }, { status });
  }
}
