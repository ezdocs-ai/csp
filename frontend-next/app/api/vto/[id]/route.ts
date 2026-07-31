/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid media item ID" }, { status: 400 });
  try {
    return NextResponse.json(await (await requireApiClient()).get(`/api/gallery/item/${encodeURIComponent(id)}`));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "VTO status failed" }, { status });
  }
}
