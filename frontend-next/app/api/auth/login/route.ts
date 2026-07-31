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

import { NextRequest, NextResponse } from "next/server";

import { CSRF_COOKIE, type Role, sessionCookie, signSession, verifyCsrf } from "@/src/lib/auth/session";
import { verifyGoogleCredential } from "@/src/lib/auth/verify";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
const KNOWN_ROLES: Role[] = ["admin", "user", "creator", "workflows"];

function fallbackRoles(email: string): Role[] {
  return ADMIN_EMAILS.includes(email.toLowerCase()) ? ["admin", "user"] : ["user"];
}

/**
 * The backend is the source of truth for roles (Angular reads the same
 * `GET /api/users/me`). The env allowlist is only a fallback when that call
 * fails, so a backend hiccup cannot silently strip a user of access.
 */
async function rolesFor(email: string, idToken: string): Promise<Role[]> {
  try {
    const response = await fetch(`${process.env.BACKEND_URL ?? "http://localhost:8000"}/api/users/me`, {
      headers: { authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`users/me responded ${response.status}`);
    const profile = (await response.json()) as { roles?: unknown };
    const roles = Array.isArray(profile.roles) ? profile.roles.filter((role): role is Role => KNOWN_ROLES.includes(role as Role)) : [];
    return roles.length > 0 ? roles : fallbackRoles(email);
  } catch (error) {
    console.error("Could not read roles from backend, falling back to allowlist", { message: error instanceof Error ? error.message : error });
    return fallbackRoles(email);
  }
}

export async function POST(request: NextRequest) {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const body = (await request.json().catch(() => null)) as { credential?: string; csrfToken?: string } | null;
  if (!body?.credential || !verifyCsrf(cookieToken, body.csrfToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  try {
    const identity = await verifyGoogleCredential(body.credential);
    const session = await signSession({
      sub: identity.sub,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      hd: identity.hd,
      roles: await rolesFor(identity.email, body.credential),
      idToken: body.credential,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie(session));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    console.error("Google login failed", { message });
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
