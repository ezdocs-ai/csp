/** Copyright 2026 Google LLC — Apache-2.0 */
import { WorkflowList } from "@/src/features/workflows";
import { requireRole } from "@/src/lib/auth/server";

export default async function WorkflowsPage() {
  // Angular gates /workflows on WORKFLOWS+ADMIN. Strengthened from requireUser to match.
  const session = await requireRole(["workflows", "admin"]);
  const canEdit = session.roles.includes("admin") || session.roles.includes("workflows");
  return <WorkflowList canEdit={canEdit} />;
}
