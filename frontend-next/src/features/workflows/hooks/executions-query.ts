/** Copyright 2026 Google LLC — Apache-2.0 */
/*
 * Pure helpers for the executions list hook. Kept free of React so they can be
 * unit-tested directly. Backend contract: GET /api/workflows/{id}/executions
 * supports `limit`/`page_token`/`status` and returns `{executions, next_page_token}`
 * (matching the Angular WorkflowService.getExecutions response). Each item exposes
 * `state` (ACTIVE|SUCCEEDED|FAILED|...), `start_time`, `duration`, and optional
 * `end_time`/`result`/`step_entries`. The UI WorkflowExecution type (shared, not
 * editable here) uses `status` (running|completed|failed|stopped), so state is
 * normalized here; extra fields (duration/raw result) are stashed on `result`.
 */
import type { WorkflowExecution } from "../types";

// Local status union (the shared workflows `WorkflowExecution` type uses an inline
// union, not a named export). Mirrors workflow-run's WorkflowExecutionStatus.
export type WorkflowExecutionStatus = "running" | "completed" | "failed" | "stopped";

export type ExecutionStatusFilter = "ALL" | "ACTIVE" | "SUCCEEDED" | "FAILED";

/** Map a backend execution `state` (or legacy UI status) to the UI status enum. */
export function mapExecutionStateToStatus(state: unknown): WorkflowExecutionStatus {
  const normalized = typeof state === "string" ? state.toUpperCase().replace(/^STATE_/, "") : "";
  switch (normalized) {
    case "ACTIVE":
    case "RUNNING":
    case "PENDING":
    case "QUEUED":
      return "running";
    case "SUCCEEDED":
    case "COMPLETED":
      return "completed";
    case "FAILED":
    case "ERROR":
      return "failed";
    case "CANCELLED":
    case "CANCELED":
    case "STOPPED":
      return "stopped";
    default:
      return normalized ? "stopped" : "stopped";
  }
}

type RawExecution = Record<string, unknown> & {
  id?: unknown;
  execution_id?: unknown;
  state?: unknown;
  status?: unknown;
  start_time?: unknown;
  startTime?: unknown;
  end_time?: unknown;
  endTime?: unknown;
  duration?: unknown;
  result?: unknown;
  step_entries?: unknown;
  stepHistory?: unknown;
};

/** Normalize one backend execution list item into the UI shape (workflowId injected). */
export function normalizeExecution(raw: unknown, workflowId: string): WorkflowExecution {
  const item = (raw ?? {}) as RawExecution;
  const id = String(item.id ?? item.execution_id ?? "");
  const startTime = ((item.start_time ?? item.startTime) as string | undefined) ?? undefined;
  const endTime = ((item.end_time ?? item.endTime) as string | undefined) ?? undefined;
  const status = mapExecutionStateToStatus(item.state ?? item.status);
  // The shared workflows WorkflowExecution has no stepHistory field; fold step_entries
  // (plus duration) into `result` so the detail modal can surface them from current data.
  const extra: Record<string, unknown> = {};
  if (item.duration !== undefined) extra.duration = item.duration;
  if (item.error !== undefined) extra.error = item.error;
  if (Array.isArray(item.step_entries)) extra.step_entries = item.step_entries;
  const result = item.result ?? (Object.keys(extra).length > 0 ? extra : undefined);
  return { id, workflowId, status, ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}), ...(result !== undefined ? { result } : {}) } satisfies WorkflowExecution;
}

export interface ExecutionsResponseData {
  executions: unknown[];
  nextPageToken: string | null;
}

/**
 * Parse the backend executions response. Tolerates `{executions, next_page_token}`,
 * `{items, next_page_token}`, a bare array, or `{}`. Returns the raw list + token;
 * callers normalize each item with normalizeExecution.
 */
export function parseExecutionsResponse(value: unknown): ExecutionsResponseData {
  if (Array.isArray(value)) return { executions: value, nextPageToken: null };
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const list = Array.isArray(obj.executions) ? obj.executions : Array.isArray(obj.items) ? obj.items : Array.isArray(obj.data) ? obj.data : [];
    const token = obj.next_page_token ?? obj.nextPageToken ?? obj.page_token ?? null;
    return { executions: list, nextPageToken: typeof token === "string" && token.length > 0 ? token : null };
  }
  return { executions: [], nextPageToken: null };
}

/** Build the query string for the executions BFF route (omits empty/all filters). */
export function buildExecutionsQuery(input: { limit: number; pageToken?: string | null; status?: ExecutionStatusFilter | string }): string {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit));
  if (input.pageToken) params.set("page_token", input.pageToken);
  const status = input.status && input.status !== "ALL" ? input.status : "";
  if (status) params.set("status", status);
  return params.toString();
}
