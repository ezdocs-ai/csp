// Copyright 2026 Google LLC
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
import { tagSearchPayloadFromQuery } from "@/src/features/admin/tags-payload";

export async function POST(request: NextRequest) {
  await requireRole(["admin"]);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const api = await requireApiClient();
  if (body.action === "search") {
    const data = await api.post("/api/tags/search", JSON.stringify(body.data ?? {}));
    return NextResponse.json(data);
  }
  if (body.action === "bulk-assign") {
    await api.post("/api/tags/bulk-assign", JSON.stringify(body.data ?? {}));
    return new NextResponse(null, { status: 204 });
  }
  const data = await api.post("/api/tags", JSON.stringify(body));
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  await requireRole(["admin"]);
  const api = await requireApiClient();
  const payload = tagSearchPayloadFromQuery(request.nextUrl.searchParams);
  const data = await api.post("/api/tags/search", JSON.stringify(payload));
  return NextResponse.json(data);
}
