/** Copyright 2026 Google LLC — Apache-2.0 */

import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const api = await requireApiClient();
  const data = await api.get(`/api/gallery/item/${id}`);
  return NextResponse.json(data);
}
