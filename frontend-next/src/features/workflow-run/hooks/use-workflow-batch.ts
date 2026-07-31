/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useState } from "react";
import { useWorkspace } from "@/src/lib/workspace";
import type { WorkflowBatchRow, WorkflowExecution } from "../types";

const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=")[1] ?? "";
export function useWorkflowBatch(workflowId: string, refresh: () => Promise<void>) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace ? Number(activeWorkspace.id) : 0;
  const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, running: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useCallback(async (batch: WorkflowBatchRow[]) => {
    setLoading(true); setError(null); setProgress({ total: batch.length, completed: 0, failed: 0, running: batch.length });
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/run`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ batch, workspaceId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Batch run failed.");
      const executions = (Array.isArray(data) ? data : data.executions ?? []) as WorkflowExecution[];
      const failed = executions.filter(({ status }) => status === "failed").length;
      setProgress({ total: batch.length, completed: executions.filter(({ status }) => status === "completed").length, failed, running: Math.max(0, batch.length - failed) });
      await refresh();
      return executions;
    } catch (cause) { const text = cause instanceof Error ? cause.message : "Batch run failed."; setError(text); throw new Error(text); }
    finally { setLoading(false); }
  }, [refresh, workflowId, workspaceId]);
  return { submit, progress, loading, error };
}
