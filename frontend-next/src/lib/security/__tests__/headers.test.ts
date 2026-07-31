/** Copyright 2026 Google LLC — Apache-2.0 */
import { expect, test } from "bun:test";

import { buildContentSecurityPolicy } from "../headers";

test("buildContentSecurityPolicy: production profile", () => {
  const csp = buildContentSecurityPolicy({ dev: false });
  expect(csp).not.toContain("\n");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("upgrade-insecure-requests");
  expect(csp).toContain("script-src 'self' 'unsafe-inline' https://accounts.google.com");
  expect(csp).toContain("img-src 'self' data: blob: https://storage.googleapis.com");
  expect(csp).toContain("frame-src https://accounts.google.com");
  expect(csp).toContain("object-src 'none'");
});

test("buildContentSecurityPolicy: development profile", () => {
  const csp = buildContentSecurityPolicy({ dev: true });
  expect(csp).toContain("'unsafe-eval'");
  expect(csp).toContain("frame-ancestors 'self'");
  expect(csp).toContain("ws: wss:");
  // HMR websocket must not be force-upgraded to TLS in dev.
  expect(csp).not.toContain("upgrade-insecure-requests");
});
