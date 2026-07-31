/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

test("theme boundaries rebind component surface tokens", () => {
  expect(tokens).toContain("[data-theme] {");
  expect(tokens).toContain("--tri-card-bg: var(--tri-bg-surface);");
  expect(tokens).toContain("--tri-input-bg: var(--tri-bg-surface);");
});

test("dark theme enables native dark controls", () => {
  expect(tokens).toMatch(/\[data-theme="dark"\]\s*\{[\s\S]*?color-scheme:\s*dark;/);
});

test("theme boundaries define the five-color admin chart palette", () => {
  for (const name of ["--color-primary", "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"]) {
    expect(tokens).toContain(`${name}:`);
  }
});
