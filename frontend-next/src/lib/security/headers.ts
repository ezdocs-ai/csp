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

// Pure Content-Security-Policy builder. Extracted so it can be unit-tested
// independently of next.config.ts (which Next bundles at build time).
//
// Profile is nonce-less (no per-request nonce middleware). Next.js inline
// runtime therefore requires 'unsafe-inline' on script-src/style-src; this is
// the documented "Without Nonces" approach. Tighten later via SRI or nonce
// middleware (see node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md).

export type CspOptions = { dev: boolean };

export function buildContentSecurityPolicy({ dev }: CspOptions): string {
  // Google Identity Services (GIS / FedCM): script + iframe + token exchange.
  const googleAccounts = "https://accounts.google.com";
  // Signed Google Cloud Storage media (presigned URLs served to <img>).
  const gcsMedia = "https://storage.googleapis.com https://*.storage.googleapis.com";
  // Google profile pictures.
  const googleAvatars = "https://lh3.googleusercontent.com https://*.googleusercontent.com";

  const scriptSrc = dev
    ? `'self' 'unsafe-inline' 'unsafe-eval' ${googleAccounts}`
    : `'self' 'unsafe-inline' ${googleAccounts}`;
  const frameAncestors = dev ? "'self'" : "'none'";
  const connectSrc = dev ? `'self' ${googleAccounts} ws: wss:` : `'self' ${googleAccounts}`;
  // upgrade-insecure-requests is omitted in dev: it would rewrite the HMR
  // websocket (ws://) to wss:// and break fast-refresh on localhost.
  const upgrade = dev ? "" : "upgrade-insecure-requests;";

  return [
    "default-src 'self';",
    `script-src ${scriptSrc};`,
    "style-src 'self' 'unsafe-inline';",
    `img-src 'self' data: blob: ${gcsMedia} ${googleAvatars};`,
    "font-src 'self' data:;",
    `connect-src ${connectSrc};`,
    `frame-src ${googleAccounts};`,
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    `frame-ancestors ${frameAncestors};`,
    upgrade,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
