/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, Input, LoadingState } from "@/src/components/ui";
import { useToast } from "@/src/components/ui/toast-provider";
import { useWorkflows } from "../hooks/use-workflows";
import type { Workflow } from "../types";

export function formatTimeAgo(dateString?: string): string {
  if (!dateString) return "";
  const seconds = Math.round(Math.abs((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 30) return "Just now";
  const intervals: Record<string, number> = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 };
  for (const name in intervals) { if (seconds >= intervals[name]) { const count = Math.floor(seconds / intervals[name]); return `${count} ${name}${count > 1 ? "s" : ""} ago`; } }
  return `${Math.floor(seconds)} seconds ago`;
}

export function WorkflowList({ canEdit = false }: { canEdit?: boolean }) {
  const router = useRouter();
  const { workflows, loading, loadingMore, error, query, setQuery, hasMore, loadMore, remove } = useWorkflows();
  const { show } = useToast();
  const [deleting, setDeleting] = useState<Workflow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    try { setActionError(null); await remove(deleting.id); show("Workflow deleted.", "success"); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Workflow delete failed"); }
    finally { setDeleting(null); }
  };

  return (
    <section aria-label="Workflow list" className="mx-auto max-w-[var(--tri-layout-wide)] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[length:var(--tri-text-h2-size)] leading-[var(--tri-text-h2-line-height)] tracking-[var(--tri-text-h2-tracking)] font-[var(--tri-font-weight-semibold)]">My Workflows</h1>
        {canEdit ? <Button onClick={() => router.push("/workflows/new")} type="button">+ New</Button> : null}
      </div>

      {/* Debounced filter (500ms) — query change auto-searches; no manual submit needed. */}
      <Input aria-label="Filter workflows" onChange={(event) => setQuery(event.target.value)} placeholder="Filter workflows…" value={query} />

      {error || actionError ? <p className="text-[length:var(--tri-text-small-size)] text-[var(--tri-state-error)]" role="alert">{error ?? actionError}</p> : null}

      {loading && workflows.length === 0 ? <LoadingState label="Loading workflows" /> : null}

      {!loading && workflows.length === 0 && !error ? (
        <EmptyState description={canEdit ? "Create your first workflow to get started." : "No workflows have been shared with you yet."} title="No workflows found" actions={canEdit ? <Button onClick={() => router.push("/workflows/new")} type="button">+ New workflow</Button> : undefined} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => {
            const stepCount = workflow.definition?.steps?.length ?? 0;
            return (
              <li key={workflow.id}>
                <div className="flex h-full flex-col justify-between rounded-[var(--tri-card-radius)] border border-[var(--tri-card-border)] bg-[var(--tri-card-bg)] p-[var(--tri-space-4)] shadow-[var(--tri-shadow-sm)] transition-[var(--tri-button-transition)] hover:border-[var(--tri-card-interactive-hover-border)] hover:shadow-[var(--tri-shadow-md)]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="truncate font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">
                        <Link className="hover:underline" href={`/workflows/${encodeURIComponent(workflow.id)}`}>
                          {workflow.name}
                        </Link>
                      </h2>
                      <Badge tone={stepCount > 0 ? "success" : "neutral"}>
                        {stepCount > 0 ? `${stepCount} steps` : "Draft"}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">
                      {workflow.description || "No description provided"}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3 pt-3 border-t border-[var(--tri-border-subtle)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">
                      <span suppressHydrationWarning>{formatTimeAgo(workflow.updatedAt)}</span>
                      {workflow.createdAt ? (
                        <span suppressHydrationWarning className="font-[var(--tri-font-code)]">
                          {new Date(workflow.createdAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>

                    {canEdit ? (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Link
                          className="inline-flex min-h-[var(--tri-control-height-md)] items-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] px-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] hover:bg-[var(--tri-button-secondary-hover)]"
                          href={`/workflows/${encodeURIComponent(workflow.id)}/edit`}
                        >
                          Edit
                        </Link>
                        <Link
                          className="inline-flex min-h-[var(--tri-control-height-md)] items-center rounded-[var(--tri-button-radius)] bg-[var(--tri-bg-surface-elevated)] px-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)] hover:bg-[var(--tri-button-secondary-hover)]"
                          href={`/workflows/${encodeURIComponent(workflow.id)}/run`}
                        >
                          ▶ Run
                        </Link>
                        <Button onClick={() => setDeleting(workflow)} type="button" variant="danger" className="px-3">
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Page/offset pagination from WorkflowSearchResponseDto metadata; query preserved. */}
      {hasMore && workflows.length > 0 ? (
        <div className="flex justify-center">
          <Button disabled={loadingMore} onClick={() => loadMore()} type="button" variant="secondary">{loadingMore ? "Loading…" : "Load more"}</Button>
        </div>
      ) : null}

      <ConfirmDialog confirmLabel="Delete" message={deleting ? `Delete workflow "${deleting.name}"? This action cannot be undone.` : ""} onClose={() => setDeleting(null)} onConfirm={() => void confirmDelete()} open={Boolean(deleting)} tone="danger" title="Confirm deletion" />
    </section>
  );
}
