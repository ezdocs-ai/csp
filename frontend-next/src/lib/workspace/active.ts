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

export type WorkspaceSource = "url" | "localStorage" | "default" | "none";

export type ResolveInput = {
  urlParam?: string | null;
  localStorageValue?: string | null;
  defaultWorkspaceId?: string | null;
  workspaces?: ReadonlyArray<{ id: string }>;
};

export type ResolveResult = {
  id: string | null;
  source: WorkspaceSource;
};

const STORAGE_KEY = "activeWorkspaceId"; // matches Angular `workspace.service.ts`
const URL_PARAM = "workspaceId";

export function resolveActiveWorkspace(input: ResolveInput): ResolveResult {
  const ids = new Set((input.workspaces ?? []).map((w) => w.id));
  const valid = (id: string | null | undefined): id is string =>
    typeof id === "string" && id.length > 0 && (ids.size === 0 || ids.has(id));

  if (valid(input.urlParam)) return { id: input.urlParam, source: "url" };
  if (valid(input.localStorageValue)) return { id: input.localStorageValue, source: "localStorage" };
  if (valid(input.defaultWorkspaceId)) return { id: input.defaultWorkspaceId, source: "default" };
  return { id: null, source: "none" };
}

export const WORKSPACE_STORAGE_KEY = STORAGE_KEY;
export const WORKSPACE_URL_PARAM = URL_PARAM;
