/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkflowExecution } from "../types";
import {
  buildExecutionsQuery,
  normalizeExecution,
  parseExecutionsResponse,
  type ExecutionStatusFilter,
} from "./executions-query";

const EXECUTIONS_PAGE_SIZE = 20;

export function useWorkflowExecutions(workflowId: string, status: ExecutionStatusFilter = "ALL") {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const nextPageTokenRef = useRef<string | null>(null);

  // Stable fetch that returns raw list + token; mapping/state normalization lives here
  // so every render path (initial / loadMore / poll) sees UI-shaped statuses.
  const fetchPage = useCallback(
    async (pageToken: string | null) => {
      const qs = buildExecutionsQuery({ limit: EXECUTIONS_PAGE_SIZE, pageToken, status });
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/executions?${qs}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Workflow executions failed");
      const parsed = parseExecutionsResponse(data);
      const mapped = parsed.executions.map((item) => normalizeExecution(item, workflowId));
      return { mapped, nextPageToken: parsed.nextPageToken };
    },
    [workflowId, status],
  );

  // Initial / reset load (replaces list). Re-runs whenever workflowId or status changes.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { mapped, nextPageToken } = await fetchPage(null);
      setExecutions(mapped);
      nextPageTokenRef.current = nextPageToken;
      setHasMore(Boolean(nextPageToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow executions failed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    const token = nextPageTokenRef.current;
    if (!token || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const { mapped, nextPageToken } = await fetchPage(token);
      setExecutions((current) => [...current, ...mapped]);
      nextPageTokenRef.current = nextPageToken;
      setHasMore(Boolean(nextPageToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow executions failed");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Poll while any execution is still active (matches Angular checkAndStartPolling).
  useEffect(() => {
    if (!executions.some((execution) => execution.status === "running")) return;
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [executions, load]);

  return { executions, loading, loadingMore, error, hasMore, loadMore, refresh: load };
}
