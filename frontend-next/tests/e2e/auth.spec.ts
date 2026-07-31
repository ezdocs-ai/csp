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

import { expect, test } from "@playwright/test";

test("login renders Google Identity Services container", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator("div.min-h-\\[44px\\]")).toBeVisible();
});

test("unauthenticated studio root redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?next=%2F|\?next=\/)?$/);
});

test("@manual non-admin admin route redirects to studio root", async ({ page }) => {
  test.skip(true, "No test-only session issuer: real Google login remains manual.");
  await page.goto("/admin");
  await expect(page).toHaveURL("/");
});
