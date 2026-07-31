/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui";
import { useCsvParser } from "../hooks/use-csv-parser";
import type { WorkflowBatchRow } from "../types";

export function BatchCsvUpload({ fields, imageFields, loading, onSubmit }: { fields: string[]; imageFields?: string[]; loading: boolean; onSubmit: (batch: WorkflowBatchRow[]) => Promise<unknown> }) {
  const parse = useCsvParser(fields, imageFields); const [csv, setCsv] = useState<ReturnType<typeof parse> | null>(null);
  return <div className="grid gap-4"><label className="grid gap-2" htmlFor="workflow-csv">CSV file<Input accept=".csv,text/csv" id="workflow-csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then((text) => setCsv(parse(text))); }} type="file" /></label>
    {csv?.errors.map((error) => <p className="text-sm text-[var(--tri-error)]" key={error}>{error}</p>)}
    {csv?.rows.length ? <><Table><TableHeader><TableRow>{csv.headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{csv.rows.slice(0, 5).map((row, index) => <TableRow key={index}>{csv.headers.map((header) => <TableCell key={header}>{String(row[header] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table><p className="text-sm">{csv.rows.length} rows. Preview shows first 5.</p><Button disabled={loading || Boolean(csv.errors.length)} onClick={() => void onSubmit(csv.rows)}>{loading ? "Starting…" : "Run batch"}</Button></> : null}
  </div>;
}
