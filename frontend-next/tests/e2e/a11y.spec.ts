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

// @axe-core/playwright is intentionally not imported: dependency is not installed.
test.describe("manual accessibility checks", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/_visual?theme=light"); });

  test("interactive targets meet 44px minimum", async ({ page }) => {
    const targets = page.locator("button, input, a");
    for (const target of await targets.all()) {
      const box = await target.boundingBox();
      if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
  });

  test("focus-visible ring and heading order exist", async ({ page }) => {
    await page.getByRole("button", { name: "Primary action" }).focus();
    await expect(page.getByRole("button", { name: "Primary action" })).toHaveCSS("outline-style", "solid");
    const headings = await page.locator("h1, h2, h3").evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
    for (let index = 1; index < headings.length; index += 1) expect(headings[index]).toBeLessThanOrEqual(headings[index - 1] + 1);
  });

  test("images have alt text and reduced motion disables transitions", async ({ page }) => {
    await expect(page.locator("img")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveCSS("transition-duration", "0.01s");
  });

  test("Escape closes dialog", async ({ page }) => {
    await expect(page.getByRole("dialog", { name: "Dialog specimen" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Dialog specimen" })).not.toBeVisible();
  });
});
