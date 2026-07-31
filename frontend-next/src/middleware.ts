/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "./lib/auth/session";
import { isAllowedHost, parseAllowedHosts } from "./lib/security/hosts";

export async function middleware(request: NextRequest) {
  // Guard redirects against Host-header injection / open-redirect. Must run
  // before any NextResponse redirect built from request.url.
  const host = request.headers.get("host") ?? "";
  if (!isAllowedHost(host, parseAllowedHosts(process.env.ALLOWED_HOSTS))) {
    return new NextResponse("Invalid Host", { status: 400 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  if (request.nextUrl.pathname.startsWith("/admin") && !session.roles.includes("admin")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  // Angular gates workflows behind admin || workflows (workflows.guard.ts).
  if (request.nextUrl.pathname.startsWith("/workflows") && !session.roles.some((role) => role === "admin" || role === "workflows")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // /api/* is excluded, so /api/health is unauthenticated by design.
  matcher: ["/((?!api|_next|login|static|.*\\..*).*)"],
};
