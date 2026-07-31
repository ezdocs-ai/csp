// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

function errorResponse(error: unknown, fallback: string) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status });
}

export async function GET(request: NextRequest) {
  await requireRole(["admin"]);
  const api = await requireApiClient();
  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (!params.has("limit")) params.set("limit", "30"); // parity with Angular service default
  try {
    return NextResponse.json(await api.get(`/api/media-templates?${params.toString()}`));
  } catch (error) {
    return errorResponse(error, "Template list failed");
  }
}

export async function POST(request: NextRequest) {
  await requireRole(["admin"]);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const mediaItemId = Number(body?.mediaItemId);
  // Backend exposes only POST /media-templates/from-media-item/{id}; it derives
  // every template field server-side and does not read the request body, so no
  // invented id is fabricated here -- a real one must be supplied by the admin.
  if (!Number.isInteger(mediaItemId) || mediaItemId <= 0) {
    return NextResponse.json({ error: "mediaItemId required (backend only supports create-from-media-item)" }, { status: 400 });
  }
  const api = await requireApiClient();
  try {
    return NextResponse.json(await api.post(`/api/media-templates/from-media-item/${mediaItemId}`), { status: 201 });
  } catch (error) {
    return errorResponse(error, "Template create failed");
  }
}
