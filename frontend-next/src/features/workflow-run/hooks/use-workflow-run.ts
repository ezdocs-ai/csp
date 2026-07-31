/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/src/lib/workspace";
import type { WorkflowExecution, WorkflowRunInput } from "../types";

const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=")[1] ?? "";
const message = (value: unknown, fallback: string) => value instanceof Error ? value.message : fallback;

export function useWorkflowRun(workflowId: string) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace ? Number(activeWorkspace.id) : 0;
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/executions`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load executions.");
    setExecutions(Array.isArray(data) ? data : data.items ?? data.executions ?? []);
  }, [workflowId]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh().catch((cause) => setError(message(cause, "Could not load executions.")))); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!executions.some(({ status }) => status === "running")) return;
    const timer = window.setInterval(() => void refresh().catch((cause) => setError(message(cause, "Could not load executions."))), 3000);
    return () => window.clearInterval(timer);
  }, [executions, refresh]);
  const submit = useCallback(async (inputs: WorkflowRunInput) => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/run`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ inputs, workspaceId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Workflow run failed.");
      await refresh();
      return data as WorkflowExecution;
    } catch (cause) { const text = message(cause, "Workflow run failed."); setError(text); throw new Error(text); }
    finally { setLoading(false); }
  }, [refresh, workflowId, workspaceId]);
  return { submit, executions, loading, error, refresh };
}
