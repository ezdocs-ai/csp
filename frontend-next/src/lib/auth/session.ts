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

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "csp_session";
export const CSRF_COOKIE = "csp_csrf";
export const SESSION_TTL_SECONDS = 15 * 60;

export type Role = "admin" | "user" | "creator" | "workflows";

export type Session = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  hd?: string;
  roles: Role[];
  idToken: string;
  iat: number;
  exp: number;
  jti: string;
};

export type SessionInput = Omit<Session, "iat" | "exp" | "jti">;

export async function signSession(input: SessionInput, secret = sessionSecret()): Promise<string> {
  return new SignJWT({ email: input.email, name: input.name, picture: input.picture, hd: input.hd, roles: input.roles, idToken: input.idToken })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(secretKey(secret));
}

export async function verifySession(token: string, secret = sessionSecret()): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });
    if (!isSessionPayload(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function rotateSession(token: string, secret = sessionSecret()): Promise<string | null> {
  const session = await verifySession(token, secret);
  if (!session) return null;
  return signSession({ sub: session.sub, email: session.email, name: session.name, picture: session.picture, hd: session.hd, roles: session.roles, idToken: session.idToken }, secret);
}

export function sessionCookie(value: string) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearSessionCookie() {
  return { ...sessionCookie(""), maxAge: 0 };
}

export function csrfCookie(value: string) {
  return {
    name: CSRF_COOKIE,
    value,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function verifyCsrf(cookieToken: string | undefined, submittedToken: string | undefined): boolean {
  if (!cookieToken || !submittedToken || cookieToken.length !== submittedToken.length) return false;
  let mismatch = 0;
  for (let index = 0; index < cookieToken.length; index += 1) mismatch |= cookieToken.charCodeAt(index) ^ submittedToken.charCodeAt(index);
  return mismatch === 0;
}

function sessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters");
  return secret;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function isSessionPayload(payload: Record<string, unknown>): payload is Session {
  return typeof payload.sub === "string" && typeof payload.email === "string" && typeof payload.name === "string" && typeof payload.picture === "string" && Array.isArray(payload.roles) && payload.roles.every((role) => typeof role === "string") && typeof payload.idToken === "string" && typeof payload.iat === "number" && typeof payload.exp === "number" && typeof payload.jti === "string";
}
