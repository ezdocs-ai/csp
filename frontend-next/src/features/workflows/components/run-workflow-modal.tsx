/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useMemo, useState } from "react";
import { Button, Dialog } from "@/src/components/ui";
import { useToast } from "@/src/components/ui/toast-provider";
import { BatchCsvUpload, RunForm, WorkflowImageInputs, selectionsToInputs, type SelectedImage } from "@/src/features/workflow-run";
import { useWorkflowBatch } from "@/src/features/workflow-run/hooks/use-workflow-batch";
import { useWorkflowRun } from "@/src/features/workflow-run/hooks/use-workflow-run";
import type { WorkflowBatchRow, WorkflowRunInput } from "@/src/features/workflow-run";
import { extractInputFields, inputFields } from "./extract-input-fields";

export { extractInputFields, inputFields };

export function RunWorkflowModal({ workflowId, definition, onClose }: { workflowId: string; definition?: unknown; onClose: () => void }) {
  const [tab, setTab] = useState<"single" | "batch">("single");
  const [imageSelections, setImageSelections] = useState<Record<string, SelectedImage>>({});
  const { show } = useToast();
  const run = useWorkflowRun(workflowId);
  const batch = useWorkflowBatch(workflowId, run.refresh);
  const fields = useMemo(() => extractInputFields(definition), [definition]);
  const textFields = useMemo(() => fields.filter((field) => field.type === "text").map((field) => field.name), [fields]);
  const imageFields = useMemo(() => fields.filter((field) => field.type === "image"), [fields]);
  const imageFieldNames = useMemo(() => imageFields.map((field) => field.name), [imageFields]);
  const submit = async (inputs: WorkflowRunInput) => {
    const merged = { ...inputs, ...selectionsToInputs(imageSelections, imageFieldNames) };
    try { await run.submit(merged); show("Workflow started.", "success"); onClose(); } catch { /* hook surfaces error */ }
  };
  const submitBatch = async (rows: WorkflowBatchRow[]) => { try { await batch.submit(rows); show("Batch started.", "success"); onClose(); } catch { /* hook surfaces error */ } };
  return (
    <Dialog onClose={onClose} open size="md" title="Run workflow">
      <div className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-4)]">
        <div className="flex gap-[var(--tri-space-2)]" role="tablist">
          <Button aria-selected={tab === "single"} onClick={() => setTab("single")} role="tab" variant={tab === "single" ? "primary" : "secondary"}>Single run</Button>
          <Button aria-selected={tab === "batch"} onClick={() => setTab("batch")} role="tab" variant={tab === "batch" ? "primary" : "secondary"}>Batch CSV</Button>
        </div>
        {run.error || batch.error ? <p className="text-[length:var(--tri-text-small-size)] text-[var(--tri-state-error)]">{run.error ?? batch.error}</p> : null}
        {tab === "single" ? (
          <>
            <RunForm fields={textFields} loading={run.loading} onSubmit={submit} />
            <WorkflowImageInputs imageFields={imageFields} onChange={setImageSelections} value={imageSelections} />
          </>
        ) : <BatchCsvUpload fields={fields.map((field) => field.name)} imageFields={imageFieldNames} loading={batch.loading} onSubmit={submitBatch} />}
        {batch.progress.total ? <p className="text-[length:var(--tri-text-small-size)]">Batch: {batch.progress.completed} complete, {batch.progress.failed} failed, {batch.progress.running} running of {batch.progress.total}.</p> : null}
      </div>
    </Dialog>
  );
}
