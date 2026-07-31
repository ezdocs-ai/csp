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

import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// The dev webServer only auto-starts when targeting localhost. Staging/prod
// URLs are probed directly by CI (no synthetic auth issuer, production auth intact).
const hostname = (() => {
  try {
    return new URL(baseURL).hostname;
  } catch {
    return "localhost";
  }
})();
const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

// Storage state is NOT applied globally: that would break unauthenticated
// health/login smoke (which must always run on a clean context). Authenticated
// specs opt in per-block via test.use({ storageState }) and skip when the
// pre-generated E2E_STORAGE_STATE path is absent (see tests/e2e/smoke.spec.ts).
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  ...(isLocal
    ? {
        webServer: {
          command: "bun run dev -- --port 3000",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }
    : {}),
});
