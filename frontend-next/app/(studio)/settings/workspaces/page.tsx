/** Copyright 2026 Google LLC — Apache-2.0 */
import { WorkspaceList } from "@/src/features/workspaces";
import { requireUser } from "@/src/lib/auth/server";

export default async function WorkspacesPage() {
  await requireUser();
  return <section className="space-y-6"><header><p className="text-sm text-[var(--tri-text-secondary)]">Settings</p><h1 className="text-2xl font-semibold text-[var(--tri-text)]">Workspaces</h1></header><WorkspaceList /></section>;
}
