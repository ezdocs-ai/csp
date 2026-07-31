// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { TagManager } from "@/src/features/admin/components/tag-manager";
import { requireRole } from "@/src/lib/auth/server";

export default async function TagsPage() {
  await requireRole(["admin"]);
  return <TagManager />;
}
