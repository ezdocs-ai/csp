/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { isAllowedHost, parseAllowedHosts } from "../hosts";

test("parseAllowedHosts: splits, trims, lowercases, drops empties", () => {
  expect(parseAllowedHosts("Foo.COM, bar.io, ,BAZ.app")).toEqual(["foo.com", "bar.io", "baz.app"]);
  expect(parseAllowedHosts(undefined)).toEqual([]);
  expect(parseAllowedHosts("")).toEqual([]);
});

test("isAllowedHost: falls back to safe defaults when allowlist empty", () => {
  // localhost dev
  expect(isAllowedHost("localhost:3000", [])).toBe(true);
  expect(isAllowedHost("127.0.0.1", [])).toBe(true);
  // Cloud Run default
  expect(isAllowedHost("svc-xyz-uc.a.run.app", [])).toBe(true);
  // arbitrary attacker host blocked
  expect(isAllowedHost("evil.example.com", [])).toBe(false);
});

test("isAllowedHost: explicit allowlist overrides defaults", () => {
  const allowed = ["studio.example.com", "*.partner.io"];
  expect(isAllowedHost("studio.example.com", allowed)).toBe(true);
  expect(isAllowedHost("a.partner.io", allowed)).toBe(true);
  // defaults no longer apply once an allowlist is provided
  expect(isAllowedHost("localhost", allowed)).toBe(false);
  expect(isAllowedHost("x.run.app", allowed)).toBe(false);
});

test("isAllowedHost: edge cases (empty, case, suffix-only wildcards)", () => {
  expect(isAllowedHost("", [])).toBe(false);
  expect(isAllowedHost("LOCALHOST:3000", [])).toBe(true); // case-insensitive + port stripped
  // wildcard is a suffix match, not a substring match
  expect(isAllowedHost("notrun.app", [])).toBe(false);
  expect(isAllowedHost("evil.run.app.evil.com", [])).toBe(false);
});
