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

import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";

// Authenticated routes under smoke; override via E2E_AUTH_ROUTES="comma,sep".
// Defaults target routes any authenticated user may reach (no admin/workflows role required).
const authenticatedRoutes = (process.env.E2E_AUTH_ROUTES ?? "/,/gallery,/fun-templates")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

const storageStatePath = process.env.E2E_STORAGE_STATE;
const hasStorageState = Boolean(storageStatePath && existsSync(storageStatePath));

// --- Unauthenticated liveness: always run. This is the cutover/rollback health gate. ---

test("GET /api/health returns 200", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
});

test("unauthenticated API request returns 401", async ({ request }) => {
  const response = await request.get("/api/workspaces");
  expect(response.status()).toBe(401);
});

test("GET /login renders the sign-in page", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Creative Studio/ })).toBeVisible();
});

test("unauthenticated studio root redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?next=%2F|\?next=\/)?$/);
});

// --- Authenticated cutover smoke: skipped unless CI supplies a pre-generated storage state. ---
// Real Google login is never faked; production auth is untouched. The storage
// state (fresh session cookie) must be produced by CI out-of-band and passed via E2E_STORAGE_STATE.
test.describe("authenticated cutover smoke", () => {
  test.skip(!hasStorageState, "E2E_STORAGE_STATE not set or file missing; authenticated routes skipped.");

  test.use({ storageState: storageStatePath as string });

  for (const route of authenticatedRoutes) {
    test(`GET ${route} reachable without redirect to login`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page).not.toHaveURL(/\/login/);
    });
  }
});
