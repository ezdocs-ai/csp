/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { Fragment, useState } from "react";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type BadgeTone } from "@/src/components/ui";
import type { WorkflowExecution } from "../types";

const tone = (status: WorkflowExecution["status"]): BadgeTone =>
  status === "completed" ? "success" : status === "failed" ? "danger" : status === "running" ? "info" : "neutral";

export function ExecutionHistory({ executions }: { executions: WorkflowExecution[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Ended</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {executions.map((execution) => (
          // ponytail: Fragment keyed per-row (was unkeyed <> → React key warning). One row + optional detail row.
          <Fragment key={execution.id}>
            <TableRow className="cursor-pointer" onClick={() => setExpanded((current) => (current === execution.id ? null : execution.id))}>
              <TableCell>{execution.id}</TableCell>
              <TableCell><Badge tone={tone(execution.status)}>{execution.status}</Badge></TableCell>
              <TableCell>{execution.startTime ?? "—"}</TableCell>
              <TableCell>{execution.endTime ?? "—"}</TableCell>
            </TableRow>
            {expanded === execution.id ? (
              <TableRow key={`${execution.id}-detail`}>
                <TableCell colSpan={4}>
                  <pre className="overflow-auto text-xs">{JSON.stringify(execution.stepHistory ?? execution.result ?? "No step output.", null, 2)}</pre>
                </TableCell>
              </TableRow>
            ) : null}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
