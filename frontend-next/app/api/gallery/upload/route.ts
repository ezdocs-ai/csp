/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";

function errorResponse(error: unknown) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : 500;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Upload failed" },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A file is required for upload." },
        { status: 400 },
      );
    }
    const api = await requireApiClient();
    const asset = await api.post("/api/source_assets/upload", formData);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
