/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useMemo, useState } from "react";

import { filterTemplates, uniqueIndustries } from "../mappers";
import { TemplateFilters } from "./template-filters";
import { TemplateGrid } from "./template-grid";
import { EMPTY_TEMPLATE_FILTER, type MediaTemplateResponse, type TemplateFilter } from "../types";

type TemplateCatalogProps = { templates: MediaTemplateResponse[] };

export function TemplateCatalog({ templates }: TemplateCatalogProps) {
  const [filter, setFilter] = useState<TemplateFilter>({ ...EMPTY_TEMPLATE_FILTER });
  const industries = useMemo(() => uniqueIndustries(templates), [templates]);
  const filtered = useMemo(() => filterTemplates(templates, filter), [templates, filter]);

  return (
    <div className="space-y-[var(--tri-space-6)]">
      <TemplateFilters industries={industries} onChange={setFilter} value={filter} />
      {filtered.length ? (
        <TemplateGrid templates={filtered} />
      ) : (
        <p className="text-[var(--tri-text-secondary)]">No templates match your filters.</p>
      )}
    </div>
  );
}
