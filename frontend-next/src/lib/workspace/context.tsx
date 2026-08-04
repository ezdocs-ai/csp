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

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ApiClient } from "../api/client";
import {
  resolveActiveWorkspace,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceSource,
} from "./active";
import {
  createWorkspace as createWorkspaceRequest,
  inviteUser as inviteUserRequest,
  listWorkspaces,
  type CreateWorkspaceInput,
  type InviteInput,
  type Workspace,
} from "./api";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeSource: WorkspaceSource;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  inviteUser: (workspaceId: string, input: InviteInput) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export type WorkspaceProviderProps = {
  children: ReactNode;
  api: ApiClient;
  initialWorkspaces?: Workspace[];
  initialUrlWorkspaceId?: string | null;
};

export function WorkspaceProvider({
  children,
  api,
  initialWorkspaces = [],
  initialUrlWorkspaceId = null,
}: WorkspaceProviderProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialWorkspaces.length === 0);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspaces(await listWorkspaces(api));
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Failed to load workspaces"));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (initialWorkspaces.length > 0) return;
    void listWorkspaces(api)
      .then((items) => {
        setWorkspaces(items);
        setError(null);
      })
      .catch((cause) => setError(cause instanceof Error ? cause : new Error("Failed to load workspaces")))
      .finally(() => setLoading(false));
  }, [api, initialWorkspaces.length]);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const resolved = useMemo(() => {
    let localStorageValue: string | null = null;
    if (isClient) {
      try {
        localStorageValue = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      } catch {
        // Storage unavailable or blocked.
      }
    }
    const result = resolveActiveWorkspace({
      urlParam: activeWorkspaceId ?? initialUrlWorkspaceId,
      localStorageValue,
      // Angular prefers the first PUBLIC workspace before falling back to the first of any scope.
      defaultWorkspaceId: (workspaces.find((workspace) => workspace.scope === "public") ?? workspaces[0])?.id ?? null,
      workspaces,
    });
    return {
      active: workspaces.find((workspace) => workspace.id === result.id) ?? null,
      source: result.source,
    };
  }, [activeWorkspaceId, initialUrlWorkspaceId, workspaces, isClient]);

  const setActiveWorkspace = useCallback((workspace: Workspace | null) => {
    setActiveWorkspaceId(workspace?.id ?? null);
    try {
      if (workspace) localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
      else localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch {
      // Storage unavailable or blocked.
    }
  }, []);

  const createWorkspace = useCallback(
    async (input: CreateWorkspaceInput) => {
      const workspace = await createWorkspaceRequest(api, input);
      setWorkspaces((current) => [...current, workspace]);
      setActiveWorkspace(workspace);
      return workspace;
    },
    [api, setActiveWorkspace],
  );

  const inviteUser = useCallback(
    async (workspaceId: string, input: InviteInput) => {
      await inviteUserRequest(api, workspaceId, input);
    },
    [api],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace: resolved.active,
      activeSource: resolved.source,
      setActiveWorkspace,
      loading,
      error,
      refresh,
      createWorkspace,
      inviteUser,
    }),
    [
      workspaces,
      resolved,
      setActiveWorkspace,
      loading,
      error,
      refresh,
      createWorkspace,
      inviteUser,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
