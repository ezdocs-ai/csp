/** Copyright 2026 Google LLC — Apache-2.0 */
import { requireRole } from "@/src/lib/auth/server";
import { WorkflowCanvasEditor } from "@/src/features/workflow-canvas";

export default async function NewWorkflowPage() {
  await requireRole(["workflows", "admin"]);
  return <WorkflowCanvasEditor />;
}
