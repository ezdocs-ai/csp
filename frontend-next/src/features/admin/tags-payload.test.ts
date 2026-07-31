// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { test, expect } from "bun:test";

import { tagBulkAssignPayload, tagCreatePayload, tagSearchPayload, tagSearchPayloadFromQuery } from "./tags-payload";

test("tagSearchPayload scopes to workspace_id and omits empty search", () => {
  expect(tagSearchPayload({ workspaceId: 7, limit: 10, offset: 0 })).toEqual({ workspace_id: 7, limit: 10, offset: 0 });
  expect(tagSearchPayload({ workspaceId: 7, limit: 10, offset: 20, search: "hero" })).toEqual({
    workspace_id: 7,
    limit: 10,
    offset: 20,
    search: "hero",
  });
});

test("tagSearchPayloadFromQuery maps GET parameters to the backend search body", () => {
  expect(tagSearchPayloadFromQuery(new URLSearchParams("workspace_id=7&user_id=3&limit=20&offset=40&search=hero"))).toEqual({
    workspace_id: 7,
    user_id: 3,
    limit: 20,
    offset: 40,
    search: "hero",
  });
  expect(tagSearchPayloadFromQuery(new URLSearchParams("limit=invalid&search=%20%20"))).toEqual({});
});

test("tagCreatePayload forwards workspace_id and omits empty color", () => {
  expect(tagCreatePayload({ workspaceId: 3, name: "campaign" })).toEqual({ workspace_id: 3, name: "campaign" });
  expect(tagCreatePayload({ workspaceId: 3, name: "campaign", color: "#FFFFFF" })).toEqual({
    workspace_id: 3,
    name: "campaign",
    color: "#FFFFFF",
  });
});

test("tagBulkAssignPayload maps to backend contract (item_ids/item_type/tag_names)", () => {
  expect(tagBulkAssignPayload({ workspaceId: 2, itemIds: [1, 2], tagNames: ["a", "b"] })).toEqual({
    workspace_id: 2,
    item_ids: [1, 2],
    item_type: "media_item",
    tag_names: ["a", "b"],
  });
  expect(tagBulkAssignPayload({ workspaceId: 5, itemIds: [9], tagNames: ["x"], itemType: "source_asset" })).toEqual({
    workspace_id: 5,
    item_ids: [9],
    item_type: "source_asset",
    tag_names: ["x"],
  });
});
