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

import type { ApiClient } from "../api/client";

/** Mirrors `WorkspaceModel` in openapi.json (scope + ownerId are already returned). */
export type WorkspaceScope = "public" | "private";
export type Workspace = { id: string; name: string; scope: WorkspaceScope; ownerId: string | null };
export type WorkspaceListItem = Workspace;
type WireWorkspace = { id: string | number; name: string; scope?: string; ownerId?: string | number | null };

function toWorkspace(wire: WireWorkspace): Workspace {
  return {
    id: String(wire.id),
    name: wire.name,
    scope: wire.scope === "public" ? "public" : "private",
    ownerId: wire.ownerId == null ? null : String(wire.ownerId),
  };
}
export type CreateWorkspaceInput = { name: string };
export type InviteInput = { email: string };

export async function listWorkspaces(api: ApiClient) {
  return (await api.get<WireWorkspace[]>("/api/workspaces")).map(toWorkspace);
}

export async function getWorkspace(api: ApiClient, id: string) {
  return toWorkspace(await api.get<WireWorkspace>(`/api/workspaces/${id}`));
}

export async function createWorkspace(api: ApiClient, input: CreateWorkspaceInput) {
  return toWorkspace(await api.post<WireWorkspace>("/api/workspaces", JSON.stringify(input)));
}

export async function inviteUser(api: ApiClient, workspaceId: string, input: InviteInput) {
  return api.post<void>(`/api/workspaces/${workspaceId}/invites`, JSON.stringify(input));
}
