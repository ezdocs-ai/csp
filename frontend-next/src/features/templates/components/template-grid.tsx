/** Copyright 2026 Google LLC — Apache-2.0 */
import { TemplateCard } from "./template-card";
import type { MediaTemplateResponse } from "../types";

type TemplateGridProps = { templates: MediaTemplateResponse[] };

export function TemplateGrid({ templates }: TemplateGridProps) {
  return (
    <div className="grid grid-cols-1 gap-[var(--tri-space-4)] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((template) => <TemplateCard key={template.id} template={template} />)}
    </div>
  );
}
