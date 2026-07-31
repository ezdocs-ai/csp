/** Copyright 2026 Google LLC — Apache-2.0 */

import assert from "node:assert/strict";
import test from "node:test";

import { clipInset } from "../media-lightbox";

test("clipInset returns full-reveal inset at 0 percent", () => {
  assert.equal(clipInset(0), "inset(0 0 0 0%)");
});

test("clipInset hides the after image entirely at 100 percent", () => {
  assert.equal(clipInset(100), "inset(0 0 0 100%)");
});

test("clipInset splits the frame at the handle position", () => {
  assert.equal(clipInset(50), "inset(0 0 0 50%)");
  assert.equal(clipInset(25), "inset(0 0 0 25%)");
});

test("clipInset clamps out-of-range values to [0,100]", () => {
  assert.equal(clipInset(-10), "inset(0 0 0 0%)");
  assert.equal(clipInset(150), "inset(0 0 0 100%)");
});

test("clipInset rounds to an integer percentage", () => {
  assert.equal(clipInset(50.7), "inset(0 0 0 51%)");
});
