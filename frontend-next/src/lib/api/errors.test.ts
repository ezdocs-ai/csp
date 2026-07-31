/** Copyright 2026 Google LLC — Apache-2.0 */
import { describe, expect, test } from "bun:test";

import { ApiError } from "./errors";

describe("ApiError.network", () => {
  test("uses a valid Bad Gateway HTTP status", () => {
    const error = ApiError.network(new TypeError("fetch failed"));

    expect(error.status).toBe(502);
    expect(error.statusText).toBe("Bad Gateway");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.kind).toBe("network");
    expect(error.message).toBe("fetch failed");
  });

  test("preserves the network kind independently of status zero", () => {
    const error = ApiError.network("connection closed");

    expect(error.status).toBeGreaterThanOrEqual(200);
    expect(error.status).toBeLessThanOrEqual(599);
    expect(error.kind).toBe("network");
  });
});
