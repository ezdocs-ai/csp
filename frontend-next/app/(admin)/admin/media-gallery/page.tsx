// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { MediaGalleryAdmin } from "@/src/features/admin/components/media-gallery-admin";
import { requireRole } from "@/src/lib/auth/server";

export default async function MediaGalleryPage() {
  await requireRole(["admin"]);
  return <MediaGalleryAdmin />;
}
