/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, EmptyState } from "@/src/components/ui";
import { useToast } from "@/src/components/ui/toast-provider";
import type { ExecutionStatusFilter } from "../hooks/executions-query";
import { useWorkflowExecutions } from "../hooks/use-workflow-executions";
import { ExecutionDetailDialog } from "./execution-detail-dialog";
import { RunWorkflowModal } from "./run-workflow-modal";
import type { BadgeTone } from "@/src/components/ui";
import type { Workflow, WorkflowExecution } from "../types";

const statusTone = (status: WorkflowExecution["status"]): BadgeTone =>
  status === "completed" ? "success" : status === "failed" || status === "stopped" ? "danger" : status === "running" ? "info" : "neutral";

export function WorkflowDetail({ workflow, canEdit = false }: { workflow: Workflow; canEdit?: boolean }) {
  const [statusFilter, setStatusFilter] = useState<ExecutionStatusFilter>("ALL");
  // Status filter is applied server-side (backend `status` param) so pagination never
  // drops the active query — Load More passes the same status + next page token.
  const { executions, loading, loadingMore, error, hasMore, loadMore, refresh } = useWorkflowExecutions(workflow.id, statusFilter);
  const { show } = useToast();
  const [runOpen, setRunOpen] = useState(false);
  const [selected, setSelected] = useState<WorkflowExecution | null>(null);

  return (
    <section aria-label="Workflow detail" className="mx-auto max-w-[var(--tri-layout-wide)] space-y-6 px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="inline-flex min-h-[var(--tri-control-height-md)] items-center gap-[var(--tri-space-1)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)] hover:text-[var(--tri-text-primary)]" href="/workflows">← Back</Link>
          <h1 className="mt-[var(--tri-space-1)] text-2xl font-bold">{workflow.name}</h1>
          {workflow.description ? <p className="text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{workflow.description}</p> : null}
          <div className="mt-[var(--tri-space-1)] flex flex-wrap gap-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">
            {workflow.createdAt ? <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span> : null}
            {workflow.updatedAt ? <span>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setRunOpen(true)} type="button">▶ Run</Button>
          {canEdit ? <Button onClick={() => void setRunOpen(true)} type="button" variant="secondary">Batch</Button> : null}
          {canEdit ? <Link className="inline-flex min-h-[var(--tri-button-height)] items-center justify-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] px-[var(--tri-button-padding-inline)] text-[length:var(--tri-label-button-size)] font-[var(--tri-font-weight-semibold)] hover:bg-[var(--tri-button-secondary-hover)]" href={`/workflows/${encodeURIComponent(workflow.id)}/edit`}>Edit</Link> : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)]">
          Status
          <select aria-label="Filter executions by status" className="h-[var(--tri-control-height-md)] rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)]" onChange={(event) => setStatusFilter(event.target.value as ExecutionStatusFilter)} value={statusFilter}>
            <option value="ALL">All Statuses</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="FAILED">Failed</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
        <Button aria-label="Refresh executions" onClick={() => { void refresh(); show("Refreshed.", "neutral"); }} type="button" variant="ghost">↻ Refresh</Button>
      </div>

      {error ? <p className="text-[length:var(--tri-text-small-size)] text-[var(--tri-state-error)]" role="alert">{error}</p> : null}

      {loading && executions.length === 0 ? <p className="text-[var(--tri-text-secondary)]">Loading executions…</p> : null}

      {!loading && executions.length === 0 && !error ? (
        <EmptyState actions={<Button onClick={() => setRunOpen(true)} type="button">▶ Run workflow</Button>} description="Run the workflow to generate execution records." title="No executions found" />
      ) : (
        <ul className="grid gap-2">
          {executions.map((execution) => (
            <li key={execution.id}>
              <button className="flex w-full items-center justify-between gap-4 rounded-[var(--tri-card-radius)] border border-[var(--tri-card-border)] bg-[var(--tri-card-bg)] p-[var(--tri-space-3)] text-left hover:border-[var(--tri-card-border-active)]" onClick={() => setSelected(execution)} type="button">
                <div className="flex items-center gap-[var(--tri-space-3)]">
                  <Badge tone={statusTone(execution.status)}>{execution.status}</Badge>
                  <span className="font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">{execution.id}</span>
                  <span className="text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">{execution.startTime ? new Date(execution.startTime).toLocaleString() : "—"}</span>
                </div>
                <span aria-hidden className="text-[var(--tri-text-tertiary)]">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Cursor pagination via next_page_token; status filter preserved across pages. */}
      {hasMore && executions.length > 0 ? (
        <div className="flex justify-center">
          <Button disabled={loadingMore} onClick={() => void loadMore()} type="button" variant="secondary">{loadingMore ? "Loading…" : "Load more"}</Button>
        </div>
      ) : null}

      {runOpen ? <RunWorkflowModal definition={workflow.definition} onClose={() => setRunOpen(false)} workflowId={workflow.id} /> : null}
      <ExecutionDetailDialog execution={selected} onClose={() => setSelected(null)} open={selected !== null} />
    </section>
  );
}
