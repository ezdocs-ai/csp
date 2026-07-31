// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { AiProvidersAdmin } from "@/src/features/admin/components/ai-providers-admin";
import type { AiProvider } from "@/src/features/admin/ai-providers-types";
import { requireApiClient } from "@/src/lib/api/server";

export default async function AdminAiProvidersPage() {
  let initial: AiProvider[] = [];
  try {
    initial = await (await requireApiClient()).get<AiProvider[]>("/api/admin/ai-providers");
  } catch {
    // client hook surfaces error
  }
  return <AiProvidersAdmin initial={initial} />;
}
