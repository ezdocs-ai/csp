/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({ error: "ids required" }, { status: 400 });
  try {
    const blob = await (await requireApiClient()).getBlob(`/api/gallery/bulk-download?ids=${encodeURIComponent(ids)}`);
    return new NextResponse(blob, { headers: { "content-type": "application/zip", "content-disposition": "attachment; filename=gallery.zip" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Download failed" }, { status: typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500 }); }
}
