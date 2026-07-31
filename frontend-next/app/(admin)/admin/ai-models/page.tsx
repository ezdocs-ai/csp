// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { AiModelsAdmin } from "@/src/features/admin/components/ai-models-admin";
import type { AiModel } from "@/src/features/admin/ai-providers-types";
import { requireApiClient } from "@/src/lib/api/server";

export default async function AdminAiModelsPage() {
  let initial: AiModel[] = [];
  try {
    initial = await (await requireApiClient()).get<AiModel[]>("/api/admin/ai-models");
  } catch {
    // client hook surfaces error
  }
  return <AiModelsAdmin initial={initial} />;
}
