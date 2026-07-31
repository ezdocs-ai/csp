// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, fallback: string) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status });
}

function guardCsrf(request: NextRequest): NextResponse | null {
  return verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)
    ? null
    : NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
}

export async function PATCH(request: NextRequest, context: Context) {
  await requireRole(["admin"]);
  const blocked = guardCsrf(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  const api = await requireApiClient();
  try {
    // Body is already shaped to UpdateTemplateDto (camelCase) by the client.
    return NextResponse.json(await api.put(`/api/media-templates/${id}`, await request.text()));
  } catch (error) {
    return errorResponse(error, "Template update failed");
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  await requireRole(["admin"]);
  const blocked = guardCsrf(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  const api = await requireApiClient();
  try {
    await api.delete(`/api/media-templates/${id}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Template delete failed");
  }
}
