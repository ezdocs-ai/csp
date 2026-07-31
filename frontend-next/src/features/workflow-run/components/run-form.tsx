/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/src/components/ui";
import type { WorkflowRunInput } from "../types";

export function RunForm({ fields, loading, onSubmit }: { fields: string[]; loading: boolean; onSubmit: (inputs: WorkflowRunInput) => Promise<unknown> }) {
  const [inputs, setInputs] = useState<WorkflowRunInput>({});
  return <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(inputs); }}>
    {fields.length ? fields.map((field) => <Field htmlFor={`workflow-input-${field}`} key={field} label={field}><Input id={`workflow-input-${field}`} onChange={(event) => setInputs((current) => ({ ...current, [field]: event.target.value }))} value={String(inputs[field] ?? "")} /></Field>) : <p>No user input fields.</p>}
    <Button disabled={loading} type="submit">{loading ? "Starting…" : "Run workflow"}</Button>
  </form>;
}
