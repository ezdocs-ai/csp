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
import { resolveActiveWorkspace } from "../active";

test("url param wins", () => {
  const result = resolveActiveWorkspace({
    urlParam: "w1",
    localStorageValue: "w2",
    defaultWorkspaceId: "w3",
    workspaces: [{ id: "w1" }, { id: "w2" }, { id: "w3" }],
  });
  expect(result).toEqual({ id: "w1", source: "url" });
});

test("localStorage wins over default when url absent", () => {
  const result = resolveActiveWorkspace({
    localStorageValue: "w2",
    defaultWorkspaceId: "w3",
    workspaces: [{ id: "w2" }, { id: "w3" }],
  });
  expect(result).toEqual({ id: "w2", source: "localStorage" });
});

test("default used when url and localStorage absent", () => {
  const result = resolveActiveWorkspace({
    defaultWorkspaceId: "w3",
    workspaces: [{ id: "w3" }],
  });
  expect(result).toEqual({ id: "w3", source: "default" });
});

test("none when all absent", () => {
  expect(resolveActiveWorkspace({})).toEqual({ id: null, source: "none" });
});

test("invalid url param falls through", () => {
  const result = resolveActiveWorkspace({
    urlParam: "rogue",
    localStorageValue: "w2",
    workspaces: [{ id: "w2" }],
  });
  expect(result).toEqual({ id: "w2", source: "localStorage" });
});
