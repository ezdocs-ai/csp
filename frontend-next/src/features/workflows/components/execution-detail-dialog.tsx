/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { Badge, Dialog, type BadgeTone } from "@/src/components/ui";
import type { WorkflowExecution } from "../types";

type ExecutionDetailMeta = { duration?: number | string; error?: string } & Record<string, unknown>;

const toneFor = (status: WorkflowExecution["status"]): BadgeTone =>
  status === "completed" ? "success" : status === "failed" ? "danger" : status === "running" ? "info" : "neutral";

const metaOf = (execution: WorkflowExecution): ExecutionDetailMeta => {
  const result = execution.result;
  return (result && typeof result === "object" ? result : {}) as ExecutionDetailMeta;
};

/**
 * Execution detail modal — uses ONLY the data already present on the list item
 * (no separate /executions/{id} fetch). Mirrors Angular ExecutionDetailsModal
 * surface (status chip + id + timing + raw output), but renders current-data-only
 * per the parity fix scope (the Angular modal makes a fresh getExecutionDetails call).
 */
export function ExecutionDetailDialog({ execution, onClose, open }: { execution: WorkflowExecution | null; onClose: () => void; open: boolean }) {
  if (!execution) return null;
  const meta = metaOf(execution);
  const detail = execution.result;
  return (
    <Dialog description={`Workflow execution ${execution.id}`} onClose={onClose} open={open} size="lg" title="Execution details">
      <div className="mt-[var(--tri-space-4)] space-y-[var(--tri-space-3)]">
        <div className="flex flex-wrap items-center gap-[var(--tri-space-3)]">
          <Badge tone={toneFor(execution.status)}>{execution.status}</Badge>
          <span className="font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">{execution.id}</span>
        </div>
        <dl className="grid grid-cols-2 gap-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)]">
          <div>
            <dt className="text-[var(--tri-text-tertiary)]">Started</dt>
            <dd className="text-[var(--tri-text-primary)]">{execution.startTime ? new Date(execution.startTime).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--tri-text-tertiary)]">Ended</dt>
            <dd className="text-[var(--tri-text-primary)]">{execution.endTime ? new Date(execution.endTime).toLocaleString() : "—"}</dd>
          </div>
          {meta.duration !== undefined ? (
            <div>
              <dt className="text-[var(--tri-text-tertiary)]">Duration</dt>
              <dd className="text-[var(--tri-text-primary)]">{meta.duration}s</dd>
            </div>
          ) : null}
        </dl>
        {meta.error ? <p className="rounded-[var(--tri-card-radius)] bg-[var(--tri-state-error-bg,transparent)] p-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)] text-[var(--tri-state-error)]">{meta.error}</p> : null}
        {detail !== null && detail !== undefined ? (
          <details className="rounded-[var(--tri-card-radius)] border border-[var(--tri-card-border)] bg-[var(--tri-card-bg)] p-[var(--tri-space-2)]">
            <summary className="cursor-pointer text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Raw output</summary>
            <pre className="mt-[var(--tri-space-2)] overflow-auto text-xs">{JSON.stringify(detail, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </Dialog>
  );
}
