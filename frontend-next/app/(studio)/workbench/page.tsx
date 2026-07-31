/** Copyright 2026 Google LLC — Apache-2.0 */
import { requireUser } from "@/src/lib/auth/server";
import { Workbench } from "@/src/features/workbench/components/workbench";

export default async function WorkbenchPage() {
  await requireUser();
  return <Workbench />;
}
