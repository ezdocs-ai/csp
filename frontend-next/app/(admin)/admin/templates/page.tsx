// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { TemplateEditor } from "@/src/features/admin/components/template-editor";
import { requireRole } from "@/src/lib/auth/server";

export default async function TemplatesPage() {
  await requireRole(["admin"]);
  return <TemplateEditor />;
}
