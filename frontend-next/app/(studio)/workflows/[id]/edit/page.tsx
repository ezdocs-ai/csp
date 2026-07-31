/** Copyright 2026 Google LLC — Apache-2.0 */
import { notFound } from "next/navigation";
import { WorkflowCanvasEditor } from "@/src/features/workflow-canvas";
import { type WorkflowDraft } from "@/src/features/workflow-editor";
import { ApiError } from "@/src/lib/api/errors";
import { getServerApiClient } from "@/src/lib/api/server";
import { requireRole } from "@/src/lib/auth/server";

async function getWorkflow(id: string): Promise<WorkflowDraft> {
  const api = await getServerApiClient(); if (!api) notFound();
  try { return await api.get<WorkflowDraft>(`/api/workflows/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
}

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["workflows", "admin"]);
  const { id } = await params;
  const initial = await getWorkflow(id);
  return <WorkflowCanvasEditor initial={initial} />;
}
