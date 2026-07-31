/** Copyright 2026 Google LLC — Apache-2.0 */
import type {
  BatchExecutionRequestDto,
  BatchExecutionResponseDto,
  ExecutionResponseDto,
  WorkflowBatchRow,
  WorkflowExecution,
  WorkflowRunInput,
} from "./types";

/** Build the args object; inject workspace_id (snake) when the BFF can resolve it. */
export function toExecuteArgs(inputs: WorkflowRunInput, workspaceId?: number | null): Record<string, unknown> {
  return workspaceId ? { ...inputs, workspace_id: workspaceId } : { ...inputs };
}

export function toExecuteDto(inputs: WorkflowRunInput, workspaceId?: number | null) {
  return { args: toExecuteArgs(inputs, workspaceId) };
}

/**
 * CSV rows -> backend BatchExecutionRequestDto. row_index is the original batch
 * position (CSV parser emits plain keyed rows; no row_index is carried today).
 */
export function toBatchRequest(rows: WorkflowBatchRow[], workspaceId?: number | null): BatchExecutionRequestDto {
  return {
    items: rows.map((row, index) => ({ row_index: index, args: toExecuteArgs(row, workspaceId) })),
  };
}

/** {execution_id} -> UI WorkflowExecution (freshly queued run is "running"). */
export function executionResponseToUi(resp: ExecutionResponseDto, workflowId: string): WorkflowExecution {
  return { id: resp.execution_id, workflowId, status: "running" };
}

/** BatchExecutionResponseDto -> UI shape the batch hook reads ({executions: [...]}). */
export function batchResponseToUi(
  resp: BatchExecutionResponseDto,
  workflowId: string,
): { executions: WorkflowExecution[] } {
  return {
    executions: resp.results.map((result) => ({
      id: result.execution_id ?? String(result.row_index),
      workflowId,
      status: result.status === "SUCCESS" ? "completed" : "failed",
      result: result.error ? { error: result.error } : undefined,
    })),
  };
}
