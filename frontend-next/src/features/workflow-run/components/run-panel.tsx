/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui";
import { useToast } from "@/src/components/ui/toast-provider";
import { extractInputFields } from "@/src/features/workflows/components/extract-input-fields";
import { useWorkflowBatch } from "../hooks/use-workflow-batch";
import { useWorkflowRun } from "../hooks/use-workflow-run";
import { selectionsToInputs, type SelectedImage } from "../workflow-image-selection";
import type { WorkflowBatchRow, WorkflowRunInput } from "../types";
import { BatchCsvUpload } from "./batch-csv-upload";
import { ExecutionHistory } from "./execution-history";
import { MediaOutputResolver } from "./media-output-resolver";
import { RunForm } from "./run-form";
import { WorkflowImageInputs } from "./workflow-image-inputs";

export function RunPanel({ workflowId, definition }: { workflowId: string; definition?: unknown }) {
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
    try { await run.submit(merged); show("Workflow started.", "success"); } catch {}
  };
  const submitBatch = async (rows: WorkflowBatchRow[]) => { try { await batch.submit(rows); show("Batch started.", "success"); } catch {} };
  const latest = run.executions.find((execution) => execution.result !== undefined);
  return (
    <section aria-label="Run workflow" className="mx-auto max-w-[var(--tri-layout-wide)] space-y-6 px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]">
      <h1 className="text-2xl font-bold">Run workflow</h1>
      <div className="flex gap-2" role="tablist">
        <Button aria-selected={tab === "single"} onClick={() => setTab("single")} role="tab" variant={tab === "single" ? "primary" : "secondary"}>Single run</Button>
        <Button aria-selected={tab === "batch"} onClick={() => setTab("batch")} role="tab" variant={tab === "batch" ? "primary" : "secondary"}>Batch CSV</Button>
      </div>
      {tab === "single" ? (
        <>
          <RunForm fields={textFields} loading={run.loading} onSubmit={submit} />
          <WorkflowImageInputs imageFields={imageFields} onChange={setImageSelections} value={imageSelections} />
        </>
      ) : <BatchCsvUpload fields={fields.map((field) => field.name)} imageFields={imageFieldNames} loading={batch.loading} onSubmit={submitBatch} />}
      {run.error || batch.error ? <p className="text-sm text-[var(--tri-error)]">{run.error ?? batch.error}</p> : null}
      {batch.progress.total ? <p className="text-sm">Batch: {batch.progress.completed} complete, {batch.progress.failed} failed, {batch.progress.running} running of {batch.progress.total}.</p> : null}
      <section>
        <h2 className="mb-2 text-lg font-bold">Execution history</h2>
        <ExecutionHistory executions={run.executions} />
      </section>
      {latest ? <MediaOutputResolver result={latest.result} /> : null}
    </section>
  );
}
