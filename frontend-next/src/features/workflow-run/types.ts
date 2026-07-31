/** Copyright 2026 Google LLC — Apache-2.0 */
export type WorkflowRunInput = Record<string, unknown>;
export type WorkflowBatchRow = Record<string, unknown>;
export type WorkflowExecutionStatus = "running" | "completed" | "failed" | "stopped";
export type WorkflowExecution = {
  id: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startTime?: string;
  endTime?: string;
  result?: unknown;
  stepHistory?: { stepId: string; status: string; output?: unknown }[];
};

/*
 * Backend contract — execute + batch-execute DTOs.
 * Source of truth: backend OpenAPI WorkflowExecuteDto / BatchExecutionRequestDto / BatchExecutionResponseDto.
 */
export type WorkflowExecuteDto = { args: Record<string, unknown> };
export type BatchExecutionItemDto = { row_index: number; args: Record<string, unknown> };
export type BatchExecutionRequestDto = { items: BatchExecutionItemDto[] };
export type BatchItemResultStatus = "SUCCESS" | "FAILED";
export type BatchItemResultDto = {
  row_index: number;
  execution_id?: string | null;
  status: BatchItemResultStatus;
  error?: string | null;
};
export type BatchExecutionResponseDto = { results: BatchItemResultDto[] };
export type ExecutionResponseDto = { execution_id: string };
