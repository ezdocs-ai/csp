/** Copyright 2026 Google LLC — Apache-2.0 */

import { UpscaleStudio } from "@/src/features/upscale";
import { requireUser } from "@/src/lib/auth/server";

export default async function ImagenUpscalePage() {
  await requireUser();
  return <UpscaleStudio />;
}
