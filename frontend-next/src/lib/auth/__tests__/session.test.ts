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

import assert from "node:assert/strict";
import { test } from "bun:test";

import { SignJWT } from "jose";

import { signSession, verifySession, type SessionInput } from "../session";

const secret = "test-secret-with-at-least-thirty-two-characters";
const input: SessionInput = { sub: "google-subject", email: "user@example.com", name: "User", picture: "", roles: ["user"], idToken: "test-google-id-token" };

test("session round-trips", async () => {
  const token = await signSession(input, secret);
  const session = await verifySession(token, secret);
  assert.equal(session?.email, input.email);
  assert.deepEqual(session?.roles, input.roles);
});

test("session rejects tampered signature", async () => {
  const token = await signSession(input, secret);
  const [header, payload, signature] = token.split(".");
  const replacement = signature.startsWith("A") ? "B" : "A";
  const tampered = [header, payload, `${replacement}${signature.slice(1)}`].join(".");
  assert.equal(await verifySession(tampered, secret), null);
});

test("session rejects expired token", async () => {
  const token = await new SignJWT(input)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime(-1)
    .setJti("expired")
    .sign(new TextEncoder().encode(secret));
  assert.equal(await verifySession(token, secret), null);
});
