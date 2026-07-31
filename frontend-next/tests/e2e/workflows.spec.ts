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

import { expect, test, type Locator, type Page } from "@playwright/test";

// Authenticated coverage opts into the same pre-generated storage state as
// smoke.spec.ts (real Google login is never faked; production auth untouched).
// It is additionally gated on E2E_WORKFLOWS_ENABLED because /workflows/new
// requires the "workflows" (or "admin") role — a property the storage state
// alone cannot guarantee. CI only sets this when the seeded credential carries
// the role; otherwise the whole authenticated branch is skipped, not failed.
const storageStatePath = process.env.E2E_STORAGE_STATE;
const hasStorageState = Boolean(storageStatePath && existsSync(storageStatePath));
const workflowsEnabled = process.env.E2E_WORKFLOWS_ENABLED === "1";
const canRunAuthenticated = hasStorageState && workflowsEnabled;

// --- Unauthenticated gate: always runnable, no storage state required. ---

test("unauthenticated /workflows/new redirects to login", async ({ page }) => {
  await page.goto("/workflows/new");
  await expect(page).toHaveURL(/\/login/);
});

// --- Authenticated workflow canvas coverage. ---

/** CSS prefix selector for one canvas node article addressed by its stable
 *  aria-label (`${typeLabel} node: ${label}…`). Prefix-matching sidesteps the
 *  execution-order badge suffix, which is topology-derived. */
const canvasNode = (ariaPrefix: string): string => `.react-flow__node article[aria-label^="${ariaPrefix}"]`;

/** The single source handle a node exposes (virtual inputs and every generated
 *  step used here each expose exactly one output port). */
const sourceHandle = (node: Locator): Locator => node.locator(".react-flow__handle.source").first();

/** One target handle addressed by its stable React Flow `data-handleid` (the
 *  field/output name from STEP_FIELDS). */
const targetHandle = (node: Locator, handleId: string): Locator =>
  node.locator(`.react-flow__handle.target[data-handleid="${handleId}"]`).first();

/** Viewport-relative bounding box (RF handles measure in CSS pixels, so the
 *  fitView zoom/pan never affects the connection math). */
async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const value = await locator.boundingBox();
  if (!value) throw new Error("element not measurable");
  return value;
}

/** Draw a React Flow connection by dragging from the centre of `source` to the
 *  centre of `target`. RF resolves the drop via document.elementFromPoint, so the
 *  mouseup must land exactly on the target handle centre. */
async function drawConnection(page: Page, source: Locator, target: Locator): Promise<void> {
  await expect(source).toBeInViewport();
  await expect(target).toBeInViewport();
  const s = await box(source);
  const t = await box(target);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 15 });
  await page.mouse.up();
}

test.describe("authenticated workflow canvas", () => {
  test.skip(
    !canRunAuthenticated,
    "Requires E2E_STORAGE_STATE (live session) AND E2E_WORKFLOWS_ENABLED=1 (workflows/admin role)."
  );

  test.use({ storageState: storageStatePath as string });

  test("v2 independent-input graph draws five directional edges with no backend mutation", async ({ page }) => {
    // Defense-in-depth: short-circuit every mutating BFF route so an accidental
    // Save/Run can never reach the backend. The interactions below are purely
    // local canvas state (edges re-derive from config refs; persistLayout is
    // local-only), so none should fire.
    let mutationCalls = 0;
    for (const url of [
      "**/api/workflows/create",
      "**/api/workflows/*/update",
      "**/api/workflows/*/execute",
      "**/api/workflows/*/run",
    ]) {
      page.route(url, async (route) => {
        mutationCalls += 1;
        await route.fulfill({ status: 200, json: { ok: true } });
      });
    }

    await page.goto("/workflows/new");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("#workflow-canvas-main")).toBeVisible();

    // --- Studio chrome floats ABOVE the canvas overlay (WorkspaceSwitcher z-101,
    // Sidebar z-1000 > canvas shell z-40). The opaque canvas shell would hide them
    // otherwise, so their visibility proves they stack above; both stay
    // interactive (local menu/nav only), so no mutation path is opened. ---
    await expect(page.getByRole("button", { name: "Switch workspace" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tools" })).toBeVisible();

    // --- Floating overlay geometry: the canvas occupies the FULL viewport
    // (#workflow-canvas-main is `absolute inset-0` under a `fixed inset-0` shell).
    // The compact palette floats ON TOP (absolute, z-20) and does not reserve a
    // layout column. The inspector remains hidden until a node is selected. ---
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const canvasBox = await box(page.locator("#workflow-canvas-main"));
    expect(canvasBox.x).toBe(0);
    expect(canvasBox.y).toBe(0);
    expect(Math.round(canvasBox.width)).toBe(viewport.width);
    expect(Math.round(canvasBox.height)).toBe(viewport.height);

    const palettePanel = page.getByRole("complementary", { name: "Step palette" });
    const inspectorPanel = page.getByRole("complementary", { name: "Node inspector" });
    await expect(palettePanel).toBeVisible();
    await expect(inspectorPanel).toHaveCount(0);
    const paletteBox = await box(palettePanel);
    expect(paletteBox.x).toBeGreaterThan(0);
    expect(paletteBox.x).toBeLessThan(viewport.width);

    // --- v2 palette: independent `Text input` / `Image input` nodes plus a
    // distinct `Ingredients to image` item. The singleton `User input` item and
    // its multi-parameter `Add parameter` editor are gone. ---
    await expect(page.getByRole("button", { name: "Add Text input" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Image input" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Ingredients to image" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add User input" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Add parameter/ })).toHaveCount(0);

    // --- Reproduce the user's no-save graph in order: Text B, Generate text,
    // Image A, Ingredients, Image C, Generate video. Each virtual input appends one
    // unique parameter to the hidden singleton and projects as an independent node,
    // so the default labels are deterministic (Text Input 1 / Image Input 1 / 2). ---
    await page.getByRole("button", { name: "Add Text input" }).click();
    await page.getByRole("button", { name: "Add Generate text" }).click();
    await page.getByRole("button", { name: "Add Image input" }).click();
    await page.getByRole("button", { name: "Add Ingredients to image" }).click();
    await page.getByRole("button", { name: "Add Image input" }).click();
    await page.getByRole("button", { name: "Add Generate video" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(6);
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);

    // The six nodes park across two deterministic columns; fitView frames them so
    // every drop target is on-screen before handle geometry is resolved.
    await page.locator(".react-flow__controls-fitview").click();

    const textInputB = page.locator(canvasNode("Text input node: Text Input 1"));
    const imageInputA = page.locator(canvasNode("Image input node: Image Input 1"));
    const imageInputC = page.locator(canvasNode("Image input node: Image Input 2"));
    const generateText = page.locator(canvasNode("Generate text node:"));
    const ingredients = page.locator(canvasNode("Ingredients to image node:"));
    const generateVideo = page.locator(canvasNode("Generate video node:"));

    // Node details are contextual: absent on load, then shown after selection.
    await textInputB.click();
    await expect(inspectorPanel).toBeVisible();
    const inspectorBox = await box(inspectorPanel);
    expect(inspectorBox.width).toBeLessThanOrEqual(320);

    // --- Five directional edges, wired exactly as the user draws them. Connecting
    // writes one local config ref patch only (no reorder: the hidden singleton sits
    // at index 0 and the generated steps are added in execution order), so each
    // edge materialises immediately. RF Bézier + ArrowClosed marker carries smooth
    // directionality without right-angle bends. ---
    // 1. Text B -> Generate text prompt (text output -> acceptsRef prompt).
    await drawConnection(page, sourceHandle(textInputB), targetHandle(generateText, "prompt"));
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    // 2. Generate text output -> Ingredients prompt (generated_text -> acceptsRef prompt).
    await drawConnection(page, sourceHandle(generateText), targetHandle(ingredients, "prompt"));
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    // 3. Image A -> Ingredients input_images (image output -> image-ingredients ref-list).
    await drawConnection(page, sourceHandle(imageInputA), targetHandle(ingredients, "input_images"));
    await expect(page.locator(".react-flow__edge")).toHaveCount(3);
    // 4. Ingredients generated_image -> Generate video input_images (image -> generic ref-list).
    await drawConnection(page, sourceHandle(ingredients), targetHandle(generateVideo, "input_images"));
    await expect(page.locator(".react-flow__edge")).toHaveCount(4);
    // 5. Image C -> same Generate video input_images (second image fan-in onto the list).
    await drawConnection(page, sourceHandle(imageInputC), targetHandle(generateVideo, "input_images"));
    await expect(page.locator(".react-flow__edge")).toHaveCount(5);

    // --- Assert: v2 independent input nodes. Three project here (Text B plus the
    // two IMAGE inputs A and C). A and C are the same-type pair that was impossible
    // under one singleton, so they must be two SEPARATE node wrappers with no
    // multi-parameter editor. ---
    await expect(page.locator('[data-tri-step-type="user-input"]')).toHaveCount(3);
    const imageInputNodes = page
      .locator(".react-flow__node")
      .filter({ has: page.locator('article[aria-label^="Image input node:"]') });
    await expect(imageInputNodes).toHaveCount(2);

    // --- Assert: Ingredients identity renders distinct from a plain Generate
    // image (exactly one image-type backend node, labelled "Ingredients to image"),
    // and the six-node graph is intact. ---
    await expect(page.locator('[data-tri-step-type="image"]')).toHaveCount(1);
    await expect(page.locator('[data-tri-step-type="text"]')).toHaveCount(1);
    await expect(page.locator('[data-tri-step-type="video"]')).toHaveCount(1);
    await expect(ingredients.getByText("Ingredients to image")).toBeVisible();

    // No singleton multi-parameter editor surfaced anywhere during the build.
    await expect(page.getByRole("button", { name: /Add parameter/ })).toHaveCount(0);

    // A connector can be removed directly without deleting either endpoint:
    // select its generous interaction path, then press Delete or Backspace.
    await page.locator(".react-flow__edge-interaction").first().click({ force: true });
    await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__edge")).toHaveCount(4);
    await expect(page.locator(".react-flow__node")).toHaveCount(6);

    expect(mutationCalls).toBe(0);
  });

  test("mobile drawers float over the full-viewport canvas without horizontal overflow", async ({ page }) => {
    // Below lg the floating rails are hidden and the drawer triggers appear under
    // the toolbar. The canvas overlay still spans the whole viewport (it is
    // `absolute inset-0`, not layout-reserved), so the drawers slide over it
    // instead of shifting layout columns.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/workflows/new");
    await expect(page.locator("#workflow-canvas-main")).toBeVisible();

    const viewport = page.viewportSize() ?? { width: 390, height: 844 };
    const canvasBox = await box(page.locator("#workflow-canvas-main"));
    expect(Math.round(canvasBox.x)).toBe(0);
    expect(Math.round(canvasBox.y)).toBe(0);
    expect(Math.round(canvasBox.width)).toBe(viewport.width);
    expect(Math.round(canvasBox.height)).toBe(viewport.height);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const palette = page.getByRole("button", { name: "Palette", exact: true });
    await expect(palette).toBeVisible();
    await palette.click();
    const paletteDialog = page.getByRole("dialog", { name: "Step palette" });
    await expect(paletteDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(paletteDialog).toHaveCount(0);

    const inspector = page.getByRole("button", { name: "Inspector", exact: true });
    await expect(inspector).toBeVisible();
    await inspector.click();
    const inspectorDialog = page.getByRole("dialog", { name: "Node inspector" });
    await expect(inspectorDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inspectorDialog).toHaveCount(0);
  });
});
