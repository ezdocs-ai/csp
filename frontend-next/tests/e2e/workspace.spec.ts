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
import { merged } from "../fixtures/routes";

test.describe("workspace", () => {
  test.skip(!merged.workspace, "Workspace settings and dialogs have not merged.");
  test("settings render and create dialog opens", async ({ page }) => {
    await page.goto("/settings/workspace");
    await expect(page.getByRole("heading", { name: /workspace settings/i })).toBeVisible();
    await page.getByRole("button", { name: /create workspace/i }).click();
    await expect(page.getByRole("dialog", { name: /create workspace/i })).toBeVisible();
  });

  test("invite dialog validates email", async ({ page }) => {
    await page.goto("/settings/workspace");
    await page.getByRole("button", { name: /invite/i }).click();
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByRole("button", { name: /send invite/i }).click();
    await expect(page.getByRole("alert")).toContainText(/valid email/i);
  });
});
