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

import { expect, test } from "bun:test";

import { clamp, formatTime, parseTime, snapToGrid } from "../time";

test("formats and parses timeline time", () => {
  expect(formatTime(65.123)).toBe("01:05.123");
  expect(formatTime(3661.005)).toBe("01:01:01.005");
  expect(parseTime("01:05.123")).toBe(65.123);
  expect(parseTime("01:01:01.005")).toBe(3661.005);
  expect(parseTime("bad")).toBeNaN();
});

test("clamps and snaps timeline values", () => {
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(12, 0, 10)).toBe(10);
  expect(clamp(5, 0, 10)).toBe(5);
  expect(snapToGrid(1.049, 100)).toBe(1);
  expect(snapToGrid(1.051, 100)).toBe(1.1);
});
