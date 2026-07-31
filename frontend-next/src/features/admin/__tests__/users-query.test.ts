/**
 * Copyright 2026 Google LLC — Apache-2.0
 */
import { expect, test } from "bun:test";

import { buildUsersQuery } from "../hooks/use-admin-users";
import { pageOffset, toQuery } from "../components/admin-controls";

test("toQuery skips empty/null/undefined/false values", () => {
  expect(toQuery({ a: "x", b: "", c: null, d: undefined, e: false, f: 0, g: true })).toBe("?a=x&f=0&g=true");
});

test("buildUsersQuery emits email + limit + offset and only includes deleted when true", () => {
  expect(buildUsersQuery({ email: "a@b", limit: 25, offset: 25 })).toBe("?email=a%40b&limit=25&offset=25");
  expect(buildUsersQuery({ email: "", includeDeleted: false, limit: 10 })).toBe("?limit=10");
  expect(buildUsersQuery({ includeDeleted: true, limit: 10, offset: 20 })).toBe("?includeDeleted=true&limit=10&offset=20");
});

test("pageOffset is clamped to non-negative", () => {
  expect(pageOffset(0, 10)).toBe(0);
  expect(pageOffset(3, 25)).toBe(75);
  expect(pageOffset(-2, 10)).toBe(0);
});
