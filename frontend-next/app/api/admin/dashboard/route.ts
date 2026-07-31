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

const paths = ["overview-stats", "media-over-time", "active-roles", "generation-health", "workspace-stats", "active-users-monthly"] as const;

export async function GET(request: NextRequest) {
  await requireRole(["admin"]);
  const query = request.nextUrl.searchParams.toString();
  try {
    const api = await requireApiClient();
    const [overview, mediaOverTime, activeRoles, generationHealth, mediaPerWorkspace, monthlyActiveUsers] = await Promise.all(
      paths.map((path) => api.get(`/api/admin/${path}?${query}`)),
    );
    return NextResponse.json({ overview, mediaOverTime, activeRoles, generationHealth, mediaPerWorkspace, monthlyActiveUsers });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dashboard request failed" }, { status });
  }
}

export async function POST(request: NextRequest) {
  await requireRole(["admin"]);
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  try {
    return NextResponse.json(await (await requireApiClient()).post("/api/admin/cleanup-stuck-jobs"));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cleanup failed" }, { status });
  }
}
