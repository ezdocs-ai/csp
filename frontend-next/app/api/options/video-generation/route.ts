/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";

export async function GET() {
  try {
    return NextResponse.json(await (await requireApiClient()).get("/api/options/video-generation"));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video options failed" }, { status });
  }
}
