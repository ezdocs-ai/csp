/** Copyright 2026 Google LLC — Apache-2.0 */
import { redirect } from "next/navigation";

import { TemplateCatalog, type TemplateListResponse } from "@/src/features/templates";
import { getServerApiClient } from "@/src/lib/api/server";

export default async function Page() {
  const api = await getServerApiClient();
  if (!api) redirect("/");
  // Angular `MediaTemplatesService.getMediaTemplates()` fetches `?limit=30` then
  // filters client-side (name/model/tags aren't backend filters). Mirrored here.
  let response: TemplateListResponse;
  try {
    response = await api.get(`/api/media-templates?limit=30`);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Could not load templates.");
  }
  const templates = response.data ?? [];

  return (
    <section className="space-y-[var(--tri-space-6)] text-[var(--tri-text-primary)]">
      <header className="space-y-[var(--tri-space-2)]">
        <h1 className="text-[length:var(--tri-text-h2-size)] leading-[var(--tri-text-h2-line-height)] tracking-[var(--tri-text-h2-tracking)] font-[var(--tri-font-weight-semibold)]">Fun templates</h1>
        <p className="text-[var(--tri-text-secondary)]">Start from a ready-made creative template.</p>
      </header>
      <TemplateCatalog templates={templates} />
    </section>
  );
}
