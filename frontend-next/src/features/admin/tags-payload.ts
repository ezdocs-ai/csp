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

/**
 * Pure builders for tag BFF request payloads.
 *
 * Backend contract (backend/src/tags/dto/tags_dto.py):
 *  - snake_case keys; workspace_id is a required int for create/bulk-assign.
 *  - bulk-assign uses item_ids / item_type / tag_names (NOT media_item_ids / tag_ids).
 *
 * ponytail: no validation beyond shape mapping — the BFF/backend enforce
 * authorization (WorkspaceAuth) and field presence. Add client-side guards
 * when a richer admin form lands.
 */

export type TagSearchParams = { workspaceId: number; limit: number; offset: number; search?: string };
export type TagCreateParams = { workspaceId: number; name: string; color?: string };
export type TagBulkAssignParams = { workspaceId: number; itemIds: number[]; tagNames: string[]; itemType?: string };

export function tagSearchPayload({ workspaceId, limit, offset, search }: TagSearchParams) {
  return { workspace_id: workspaceId, limit, offset, ...(search ? { search } : {}) };
}

export function tagSearchPayloadFromQuery(params: URLSearchParams) {
  const payload: Record<string, number | string> = {};
  for (const key of ["workspace_id", "user_id", "limit", "offset"] as const) {
    const value = params.get(key);
    if (!value) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) payload[key] = parsed;
  }
  const search = params.get("search")?.trim();
  if (search) payload.search = search;
  return payload;
}

export function tagCreatePayload({ workspaceId, name, color }: TagCreateParams) {
  return { workspace_id: workspaceId, name, ...(color ? { color } : {}) };
}

export function tagBulkAssignPayload({ workspaceId, itemIds, tagNames, itemType = "media_item" }: TagBulkAssignParams) {
  return { workspace_id: workspaceId, item_ids: itemIds, item_type: itemType, tag_names: tagNames };
}
