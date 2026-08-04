// Copyright 2026 Google LLC — Apache-2.0
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

/** Build a query string from filter primitives. Pure — unit-tested. */
export type SortDirection = "asc" | "desc" | null;
export interface QueryParams { [key: string]: string | number | boolean | null | undefined; }
export function toQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "boolean") { if (value) search.set(key, "true"); }
    else search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

/** Pagination offset math — pure, unit-tested. */
export function pageOffset(pageIndex: number, pageSize: number): number {
  return Math.max(0, pageIndex) * Math.max(1, pageSize);
}

/** Multi-select checkbox group (mat-select multiple equivalent). */
export interface MultiSelectOption { value: string; label: string; }
export function MultiSelect({ options, value, onChange, label, error }: { options: MultiSelectOption[]; value: string[]; onChange: (next: string[]) => void; label: string; error?: string; }) {
  const toggle = (option: string) => onChange(value.includes(option) ? value.filter((entry) => entry !== option) : [...value, option]);
  return (
    <fieldset className="grid gap-[var(--tri-space-2)]" aria-label={label}>
      <legend className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">{label}</legend>
      <div className="grid gap-[var(--tri-space-1)]">
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label key={option.value} className="inline-flex min-h-[var(--tri-control-height-md)] items-center gap-[var(--tri-space-2)] text-[var(--tri-text-primary)]">
              <input aria-checked={checked} checked={checked} onChange={() => toggle(option.value)} type="checkbox" />{option.label}
            </label>
          );
        })}
      </div>
      {error ? <p className="text-[var(--tri-text-small-size)] text-[var(--tri-input-invalid-message)]" role="alert">{error}</p> : null}
    </fieldset>
  );
}

/** Sortable column header with aria-sort. */
export function SortableHead({ active, direction, id, onSort, children }: { id: string; active: boolean; direction: SortDirection; onSort: (id: string) => void; children: ReactNode; }) {
  const sort = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
  return (
    <th aria-sort={sort} className="px-[var(--tri-space-4)] py-[var(--tri-space-3)] font-[var(--tri-font-weight-bold)]" scope="col">
      <button className="inline-flex items-center gap-[var(--tri-space-1)] hover:text-[var(--tri-text-primary)]" onClick={() => onSort(id)} type="button">
        {children}
        <span aria-hidden="true">{active ? (direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕") : "↕"}</span>
      </button>
    </th>
  );
}

/** Paginator with first/prev/next/last and page-size selector. */
export function Paginator({ pageIndex, pageSize, total, pageSizeOptions, onPage, ariaLabel = "Pagination" }: { pageIndex: number; pageSize: number; total: number; pageSizeOptions: number[]; onPage: (pageIndex: number, pageSize: number) => void; ariaLabel?: string; }) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const go = (next: number) => onPage(Math.min(Math.max(0, next), totalPages - 1), pageSize);
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center justify-between gap-[var(--tri-space-3)] border-t border-[var(--tri-table-row-divider)] px-[var(--tri-space-4)] py-[var(--tri-space-2)]">
      <p className="text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{total} item{total === 1 ? "" : "s"}</p>
      <div className="flex items-center gap-[var(--tri-space-2)]">
        <label className="inline-flex items-center gap-[var(--tri-space-2)] text-[var(--tri-text-small-size)]">
          Per page
          <select className="h-[var(--tri-control-height-md)] rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)]" onChange={(event) => onPage(0, Number(event.target.value))} value={pageSize}>
            {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-[var(--tri-space-1)]">
          <button className="grid size-[var(--tri-control-height-md)] place-items-center rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] disabled:opacity-[var(--tri-opacity-disabled)]" disabled={pageIndex === 0} onClick={() => go(0)} aria-label="First page" type="button">⏮</button>
          <button className="grid size-[var(--tri-control-height-md)] place-items-center rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] disabled:opacity-[var(--tri-opacity-disabled)]" disabled={pageIndex === 0} onClick={() => go(pageIndex - 1)} aria-label="Previous page" type="button">◀</button>
          <span className="px-[var(--tri-space-2)] text-[var(--tri-text-small-size)]">{pageIndex + 1} / {totalPages}</span>
          <button className="grid size-[var(--tri-control-height-md)] place-items-center rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] disabled:opacity-[var(--tri-opacity-disabled)]" disabled={pageIndex >= totalPages - 1} onClick={() => go(pageIndex + 1)} aria-label="Next page" type="button">▶</button>
          <button className="grid size-[var(--tri-control-height-md)] place-items-center rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] disabled:opacity-[var(--tri-opacity-disabled)]" disabled={pageIndex >= totalPages - 1} onClick={() => go(totalPages - 1)} aria-label="Last page" type="button">⏭</button>
        </div>
      </div>
    </nav>
  );
}

/** Native color input with swatch preview. */
export function ColorPicker({ value, onChange, label }: { value: string; onChange: (next: string) => void; label: string; }) {
  return (
    <label className="inline-flex min-h-[var(--tri-control-height-md)] items-center gap-[var(--tri-space-2)]">
      <span aria-hidden="true" className="size-[var(--tri-control-height-md)] rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)]" style={{ backgroundColor: value }} />
      <span className="sr-only">{label}</span>
      <input aria-label={label} className="sr-only" onChange={(event) => onChange(event.target.value)} type="color" value={value} />
    </label>
  );
}

/** Inline slide-toggle for table rows with accessible label text. */
export function SlideToggle({ checked, onChange, label, showBadge = true }: { checked: boolean; onChange: (next: boolean) => void; label: string; showBadge?: boolean; }) {
  return (
    <div className="inline-flex items-center gap-[var(--tri-space-2)]">
      <button
        aria-checked={checked}
        aria-label={label}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-a11y-focus-ring)] ${checked ? "bg-[var(--tri-state-success)]" : "bg-[var(--tri-border-strong)]"}`}
        onClick={() => onChange(!checked)}
        role="switch"
        title={label}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
      {showBadge ? (
        <span className={`text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-medium)] ${checked ? "text-[var(--tri-state-success)]" : "text-[var(--tri-text-tertiary)]"}`}>
          {checked ? "Enabled" : "Disabled"}
        </span>
      ) : null}
    </div>
  );
}

/** Debounced text-input hook for filters. */
export function useDebouncedCallback<T>(callback: (value: T) => void, delay = 500): (value: T) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);
  return useCallback((value: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saved.current(value), delay);
  }, [delay]);
}

/** role → badge tone (mirrors Angular getRoleChipClass). */
export function roleTone(role: string): "warning" | "info" | "neutral" | "success" {
  switch (role.toLowerCase()) {
    case "admin": return "warning";
    case "user": return "info";
    case "creator": return "neutral";
    case "workflows": return "success";
    default: return "neutral";
  }
}
