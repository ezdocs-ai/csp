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

import { OAuth2Client } from "google-auth-library";

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  hd?: string;
};

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity> {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true || !GOOGLE_ISSUERS.has(payload.iss ?? "")) {
    throw new Error("Invalid Google identity token");
  }
  const hostedDomain = process.env.GOOGLE_HOSTED_DOMAIN;
  if (hostedDomain && payload.hd !== hostedDomain) throw new Error("Google account is outside allowed hosted domain");

  return { sub: payload.sub, email: payload.email, name: payload.name ?? "", picture: payload.picture ?? "", hd: payload.hd };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
