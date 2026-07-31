/** Copyright 2026 Google LLC — Apache-2.0 */
export type Workflow = { id: string; name: string; description?: string; definition?: unknown; status?: string; createdAt?: string; updatedAt?: string };
export type WorkflowExecution = { id: string; workflowId: string; status: "running" | "completed" | "failed" | "stopped"; startTime?: string; endTime?: string; result?: unknown };

/*
 * Backend contract — WorkflowModel (read side). Shares the step union from the editor.
 * Source of truth: backend OpenAPI WorkflowModel.
 */
import type { BackendWorkflowStep } from "@/src/features/workflow-editor/types";

export type WorkflowModelDto = {
  name: string;
  description?: string | null;
  steps: BackendWorkflowStep[];
  id: string;
  createdAt?: string;
  updatedAt?: string;
  userId: number;
};

export type WorkflowSearchDto = { limit?: number; offset?: number; name?: string | null };
export type WorkflowSearchResponseDto = {
  data: WorkflowModelDto[] | null;
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
