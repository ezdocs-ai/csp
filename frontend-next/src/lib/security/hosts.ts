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

// Trusted-host validation. Guards middleware redirects against Host-header
// injection / open-redirect: a redirect built from `request.url` would inherit
// a spoofed Host header, so the host must be allow-listed first.

export function parseAllowedHosts(envValue: string | undefined): string[] {
  return (envValue ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

// Safe out-of-the-box defaults so local development and standard Cloud Run
// hosts work when ALLOWED_HOSTS is unset. Production operators should set
// ALLOWED_HOSTS to the exact public domains to tighten this.
const DEFAULT_HOST_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "*.run.app", // Cloud Run
];

function matchesPattern(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    // "*.run.app" matches "foo.run.app" but not "run.app" or "xrun.app".
    return host.endsWith(pattern.slice(1));
  }
  return host === pattern;
}

export function isAllowedHost(host: string, allowedHosts: string[]): boolean {
  const normalized = host.toLowerCase().split(":")[0]; // strip port
  if (!normalized) return false;
  const patterns = allowedHosts.length ? allowedHosts : DEFAULT_HOST_PATTERNS;
  return patterns.some((pattern) => matchesPattern(normalized, pattern));
}
