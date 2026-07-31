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

import { useMemo, type ReactNode } from "react";

import { createApiClient } from "@/src/lib/api";
import { ToastProvider } from "@/src/components/ui/toast-provider";
import { WorkspaceProvider, type Workspace } from "@/src/lib/workspace";

export type ProvidersProps = {
  children: ReactNode;
  initialWorkspaces?: Workspace[];
};

export function Providers({ children, initialWorkspaces }: ProvidersProps) {
  const api = useMemo(() => createApiClient({ baseUrl: "" }), []);

  return (
    <ToastProvider>
      <WorkspaceProvider api={api} initialWorkspaces={initialWorkspaces}>
        {children}
      </WorkspaceProvider>
    </ToastProvider>
  );
}

export type { Workspace };
