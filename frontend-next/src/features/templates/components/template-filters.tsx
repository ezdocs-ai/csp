/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

import { TEMPLATE_MEDIA_TYPES, EMPTY_TEMPLATE_FILTER, type TemplateFilter } from "../types";

type TemplateFiltersProps = {
  value: TemplateFilter;
  industries: string[];
  onChange: (next: TemplateFilter) => void;
};

const FIELD_CLASS =
  "min-h-11 w-full rounded-[var(--tri-radius-md)] border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] px-[var(--tri-space-3)] text-[var(--tri-text-primary)]";

export function TemplateFilters({ value, industries, onChange }: TemplateFiltersProps) {
  function patch(change: Partial<TemplateFilter>) {
    onChange({ ...value, ...change });
  }
  const hasFilter = (Object.keys(value) as (keyof TemplateFilter)[]).some((k) => value[k]);
  return (
    <div className="grid gap-[var(--tri-space-3)] md:grid-cols-3">
      <label className="grid gap-[var(--tri-space-1)]">
        <span className="text-sm text-[var(--tri-text-secondary)]">Name</span>
        <Input
          aria-label="Filter by name"
          onChange={(e) => patch({ name: e.target.value || null })}
          placeholder="Search by name"
          value={value.name ?? ""}
        />
      </label>
      <label className="grid gap-[var(--tri-space-1)]">
        <span className="text-sm text-[var(--tri-text-secondary)]">Tags</span>
        <Input
          aria-label="Filter by tags"
          onChange={(e) => patch({ tags: e.target.value || null })}
          placeholder="Search tags"
          value={value.tags ?? ""}
        />
      </label>
      <label className="grid gap-[var(--tri-space-1)]">
        <span className="text-sm text-[var(--tri-text-secondary)]">Model</span>
        <Input
          aria-label="Filter by model"
          onChange={(e) => patch({ model: e.target.value || null })}
          placeholder="Search model"
          value={value.model ?? ""}
        />
      </label>
      <label className="grid gap-[var(--tri-space-1)]">
        <span className="text-sm text-[var(--tri-text-secondary)]">Industry</span>
        <select
          aria-label="Filter by industry"
          className={FIELD_CLASS}
          onChange={(e) => patch({ industry: e.target.value || null })}
          value={value.industry ?? ""}
        >
          <option value="">All industries</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>{industry}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-[var(--tri-space-1)]">
        <span className="text-sm text-[var(--tri-text-secondary)]">Media type</span>
        <select
          aria-label="Filter by media type"
          className={FIELD_CLASS}
          onChange={(e) => patch({ mediaType: e.target.value || null })}
          value={value.mediaType ?? ""}
        >
          <option value="">All media</option>
          {TEMPLATE_MEDIA_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <Button
          className="min-h-11 w-full"
          disabled={!hasFilter}
          onClick={() => onChange({ ...EMPTY_TEMPLATE_FILTER })}
          type="button"
          variant="secondary"
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
