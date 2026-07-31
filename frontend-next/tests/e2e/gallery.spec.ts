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

test.describe("gallery", () => {
  test.skip(!merged.gallery, "Gallery route has not merged.");
  test("renders grid, paginates, and preserves filters in URL", async ({ page }) => {
    await page.goto("/gallery");
    await expect(page.getByRole("grid")).toBeVisible();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.getByLabel("Media type").selectOption("image");
    await expect(page).toHaveURL(/type=image/);
  });

  test("unknown detail returns not found", async ({ page }) => {
    await page.goto("/gallery/not-a-real-media-id");
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
  });
});
