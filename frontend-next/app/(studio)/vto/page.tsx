/** Copyright 2026 Google LLC — Apache-2.0 */
import { VtoStudio } from "@/src/features/vto-studio";
import { requireUser } from "@/src/lib/auth/server";

export default async function VtoPage() {
  await requireUser();
  return <VtoStudio />;
}
