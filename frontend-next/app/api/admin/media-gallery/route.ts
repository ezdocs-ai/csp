// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

// Maps the media-gallery-admin.tsx query string (buildMediaQuery) to the
// backend GallerySearchDto (POST /api/gallery/search). snake_case matches the
// Pydantic field names; omitted params are dropped by JSON.stringify.
export async function GET(request: NextRequest) {
  await requireRole(["admin"]);
  const params = request.nextUrl.searchParams;
  const tagsParam = params.get("tags");
  const body = {
    query: params.get("search") || undefined,
    user_email: params.get("user_email") || undefined,
    status: params.get("status") || undefined,
    item_type: params.get("item_type") || undefined,
    model: params.get("model") || undefined,
    tags: tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    start_date: params.get("start_date") || undefined,
    end_date: params.get("end_date") || undefined,
    limit: Number(params.get("limit") ?? 12),
    offset: Number(params.get("offset") ?? 0),
    include_deleted: true, // admin-wide, include soft-deleted (preserves prior behavior)
    // workspace_id intentionally omitted: route is admin-gated, search spans all workspaces
  };
  try {
    const api = await requireApiClient();
    const data = await api.post("/api/gallery/search", JSON.stringify(body));
    return NextResponse.json(data);
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Media gallery search failed" }, { status });
  }
}

export async function POST(request: NextRequest) {
  await requireRole(["admin"]);
  // Mutations (delete/restore/cleanup) require a CSRF token; reads (GET) do not.
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { action, id, itemType, workspaceId } = (await request.json().catch(() => ({}))) as {
    action?: string;
    id?: number | string;
    itemType?: string;
    workspaceId?: number | string;
  };
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });
  try {
    const api = await requireApiClient();
    if (action === "cleanup") {
      await api.post("/api/admin/cleanup-stuck-jobs");
      return new NextResponse(null, { status: 204 });
    }
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (action === "delete") {
      // BulkDeleteDto = { items: [{id, type}], workspace_id }
      if (!itemType || workspaceId === undefined) return NextResponse.json({ error: "itemType and workspaceId required for delete" }, { status: 400 });
      await api.post("/api/gallery/bulk-delete", JSON.stringify({ items: [{ id: Number(id), type: itemType }], workspace_id: Number(workspaceId) }));
      return new NextResponse(null, { status: 204 });
    }
    if (action === "restore") {
      // item_type is a query param on the restore endpoint
      if (!itemType) return NextResponse.json({ error: "itemType required for restore" }, { status: 400 });
      await api.post(`/api/gallery/items/${Number(id)}/restore?item_type=${encodeURIComponent(itemType)}`);
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Media gallery action failed" }, { status });
  }
}
