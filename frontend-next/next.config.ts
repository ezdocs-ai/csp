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

import type { NextConfig } from "next";

import { buildContentSecurityPolicy } from "./src/lib/security/headers";

const isProduction = process.env.NODE_ENV === "production";

// Production security headers. See node_modules/next/dist/docs/01-app/
// 02-guides/content-security-policy.md and 03-api-reference/05-config/
// 01-next-config-js/headers.md.
const securityHeaders = [
  { key: "Content-Security-Policy", value: buildContentSecurityPolicy({ dev: !isProduction }) },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy fallback for browsers that ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // HSTS only in production; Cloud Run terminates TLS upstream.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["3000.avei.ovh"],
  poweredByHeader: false,
  // No browser source maps in production builds (default off; explicit for intent).
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
