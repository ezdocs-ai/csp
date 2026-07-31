/** Copyright 2026 Google LLC — Apache-2.0
 * Invented route — Angular runs workflows via a modal on /workflows/:id/executions.
 * Redirect to the executions surface (now the primary per-workflow landing at /[id]).
 */
import { redirect } from "next/navigation";

export default async function RunWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/workflows/${encodeURIComponent(id)}`);
}
