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

test.describe("fun templates", () => {
  test.skip(!merged.templates, "Fun templates route has not merged.");
  test("renders grid and loads detail", async ({ page }) => {
    await page.goto("/fun-templates");
    await expect(page.getByRole("grid")).toBeVisible();
    await page.getByRole("link", { name: /.+/ }).first().click();
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("use template navigates with source parameters", async ({ page }) => {
    await page.goto("/fun-templates/example-template");
    await page.getByRole("button", { name: /use template/i }).click();
    await expect(page).toHaveURL(/[?&](templateId|template)=/);
  });
});
