/** Copyright 2026 Google LLC — Apache-2.0 */
import { notFound } from "next/navigation";
import { WorkflowDetail, type Workflow } from "@/src/features/workflows";
import { requireRole } from "@/src/lib/auth/server";
import { getServerApiClient } from "@/src/lib/api/server";
import { ApiError } from "@/src/lib/api/errors";

async function getWorkflow(id: string): Promise<Workflow> {
  const api = await getServerApiClient(); if (!api) notFound();
  try { return await api.get<Workflow>(`/api/workflows/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
}

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["workflows", "admin"]);
  const { id } = await params;
  const canEdit = session.roles.includes("admin") || session.roles.includes("workflows");
  return <WorkflowDetail canEdit={canEdit} workflow={await getWorkflow(id)} />;
}
