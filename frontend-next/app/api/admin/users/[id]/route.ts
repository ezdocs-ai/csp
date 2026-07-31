// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { NextRequest, NextResponse } from "next/server";

import { requireApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  await requireRole(["admin"]);
  const { id } = await params;
  try {
    return NextResponse.json(await (await requireApiClient()).get(`/api/users/${encodeURIComponent(id)}`));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "User fetch failed" }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  await requireRole(["admin"]);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await (await requireApiClient()).delete(`/api/users/${encodeURIComponent(id)}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "User delete failed" }, { status });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  await requireRole(["admin"]);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await (await requireApiClient()).post(`/api/users/${encodeURIComponent(id)}/restore`));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "User restore failed" }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  await requireRole(["admin"]);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await (await requireApiClient()).put(`/api/users/${encodeURIComponent(id)}`, await request.text()));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "User update failed" }, { status });
  }
}
