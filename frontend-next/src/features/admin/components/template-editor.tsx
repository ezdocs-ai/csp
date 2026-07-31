// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, Field, Input, LoadingState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui";
import { Paginator, SortableHead, useDebouncedCallback, type SortDirection } from "./admin-controls";
import { EMPTY_FORM, formToCreateBody, formToUpdateBody, parseOptionsJson, parseTags, templateToForm, type FormState, type Template } from "./template-mappers";

type SortKey = "name" | "description" | "mimeType" | "industry" | "brand";
const EXTRACT: Record<SortKey, (template: Template) => string> = {
  name: (t) => t.name ?? "",
  description: (t) => t.description ?? "",
  mimeType: (t) => t.mimeType ?? "",
  industry: (t) => t.industry ?? "",
  brand: (t) => t.brand ?? "",
};

const MIME_TONE: Record<string, "info" | "neutral"> = { "video/mp4": "info", "image/png": "neutral" };

// CSRF token mirrored from the non-httpOnly csp_csrf cookie (see use-admin-users.ts).
const csrfToken = () => document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=")[1] ?? "";

// Signed remote thumbnail URLs cannot go through next/image without
// remote-pattern config (precedent: users-table.tsx Avatar).
function Thumbnail({ template }: { template: Template }) {
  const src = template.presignedThumbnailUrls?.[0] ?? template.thumbnailUris?.[0];
  if (!src) {
    return <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]">{(template.name ?? "?").charAt(0).toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" className="size-10 rounded-full object-cover" height={40} src={src} width={40} />;
}

export function TemplateEditor() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Template>();
  const debouncedFilter = useDebouncedCallback((value: string) => { setFilter(value); setPageIndex(0); });

  // Stable loader: no external deps, only setState setters (guaranteed stable).
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/templates");
      const data = await response.json();
      setItems(data.items ?? data.data ?? data);
      setError(null);
    } catch {
      setError("Could not load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Defer the async load so setState happens outside the effect's synchronous
  // body (codebase convention: use-workflows.ts / use-workflow-executions.ts).
  useEffect(() => {
    const timer = window.setTimeout(() => void load());
    return () => window.clearTimeout(timer);
  }, [load]);

  const onSort = (id: string) => {
    const key = id as SortKey;
    const nextDir: SortDirection = key === sortKey ? (sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc") : "asc";
    setSortKey(nextDir ? key : null);
    setSortDir(nextDir);
  };

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const list = query ? items.filter((t) => [t.name, t.description, t.brand, t.industry, t.mimeType].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))) : items;
    if (!sortKey || !sortDir) return list;
    const get = EXTRACT[sortKey];
    return [...list].sort((a, b) => { const av = get(a), bv = get(b); return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av); });
  }, [items, filter, sortKey, sortDir]);

  const pageItems = filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (template: Template) => { setEditing(template); setForm(templateToForm(template)); setFormOpen(true); };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        // UpdateTemplateDto: camelCase, extra="forbid", mimeType immutable.
        const body = formToUpdateBody(form);
        const response = await fetch(`/api/admin/templates/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Save failed");
      } else {
        // Backend only exposes create-from-media-item; body is ignored, path id is required.
        const { mediaItemId } = formToCreateBody(form);
        const response = await fetch("/api/admin/templates", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ mediaItemId }) });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Create failed");
      }
      setFormOpen(false); setEditing(null); setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const response = await fetch(`/api/admin/templates/${deleting.id}`, { method: "DELETE", headers: { "x-csrf-token": csrfToken() } });
    if (!response.ok) { setError("Could not delete template."); return; }
    setDeleting(undefined);
    await load();
  }

  return (
    <section className="space-y-[var(--tri-space-4)]">
      <header className="flex flex-wrap items-center justify-between gap-[var(--tri-space-3)]">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Button onClick={openCreate}>Create Template</Button>
      </header>
      <Field htmlFor="template-filter" label="Filter templates">
        <Input id="template-filter" onChange={(event) => debouncedFilter(event.target.value)} placeholder="Ex. Rolex" />
      </Field>
      {error ? <p className="text-[var(--tri-input-invalid-message)]" role="alert">{error}</p> : null}
      {loading ? (
        <LoadingState label="Loading templates" />
      ) : filtered.length === 0 ? (
        <EmptyState actions={<Button onClick={openCreate}>Create Template</Button>} description="No templates match the filter, or none exist yet." title="No templates" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thumbnail</TableHead>
                <SortableHead active={sortKey === "name"} direction={sortKey === "name" ? sortDir : null} id="name" onSort={onSort}>Name</SortableHead>
                <SortableHead active={sortKey === "description"} direction={sortKey === "description" ? sortDir : null} id="description" onSort={onSort}>Description</SortableHead>
                <SortableHead active={sortKey === "mimeType"} direction={sortKey === "mimeType" ? sortDir : null} id="mimeType" onSort={onSort}>Media Type</SortableHead>
                <SortableHead active={sortKey === "industry"} direction={sortKey === "industry" ? sortDir : null} id="industry" onSort={onSort}>Industry</SortableHead>
                <SortableHead active={sortKey === "brand"} direction={sortKey === "brand" ? sortDir : null} id="brand" onSort={onSort}>Brand</SortableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((template) => (
                <TableRow key={template.id}>
                  <TableCell><Thumbnail template={template} /></TableCell>
                  <TableCell>{template.name}</TableCell>
                  <TableCell className="max-w-[20rem] truncate" title={template.description ?? ""}>{template.description}</TableCell>
                  <TableCell>{template.mimeType ? <Badge tone={MIME_TONE[template.mimeType] ?? "neutral"}>{template.mimeType}</Badge> : null}</TableCell>
                  <TableCell>{template.industry}</TableCell>
                  <TableCell>{template.brand || "N/A"}</TableCell>
                  <TableCell actions>
                    <div className="flex justify-end gap-[var(--tri-space-1)]">
                      <Button aria-label={`Edit ${template.name}`} onClick={() => openEdit(template)} variant="iconOnly">✎</Button>
                      <Button aria-label={`Delete ${template.name}`} onClick={() => setDeleting(template)} variant="iconOnly">🗑</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Paginator ariaLabel="Templates" onPage={(next, size) => { setPageIndex(next); setPageSize(size); }} pageIndex={pageIndex} pageSize={pageSize} pageSizeOptions={[10, 25, 100]} total={filtered.length} />
        </>
      )}

      <Dialog description="Template details. Fields map to the backend media-template record." maxWidth="60rem" onClose={() => setFormOpen(false)} open={formOpen} size="lg" title={editing ? "Edit Media Template" : "Create Media Template"}>
        <form className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-3)]" onSubmit={save}>
          {!editing ? (
            <Field htmlFor="tpl-media-item" label="Source Media Item ID" hint="Backend derives the template from this media item.">
              <Input id="tpl-media-item" onChange={(event) => setForm({ ...form, mediaItemId: event.target.value })} placeholder="Ex. 42" required type="number" value={form.mediaItemId} />
            </Field>
          ) : null}
          <Field htmlFor="tpl-name" label="Name"><Input id="tpl-name" onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></Field>
          <Field htmlFor="tpl-desc" label="Description"><textarea id="tpl-desc" className="min-h-[5rem] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] p-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)]" onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /></Field>
          <div className="grid gap-[var(--tri-space-3)] sm:grid-cols-2">
            <Field htmlFor="tpl-mime" label="Media type">
              <select id="tpl-mime" className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]" disabled={!!editing} onChange={(event) => setForm({ ...form, mimeType: event.target.value })} value={form.mimeType}>
                <option value="">—</option>
                <option value="image/png">image/png</option>
                <option value="video/mp4">video/mp4</option>
              </select>
            </Field>
            <Field htmlFor="tpl-model" label="Model"><Input id="tpl-model" onChange={(event) => setForm({ ...form, model: event.target.value })} value={form.model} /></Field>
            <Field htmlFor="tpl-industry" label="Industry"><Input id="tpl-industry" onChange={(event) => setForm({ ...form, industry: event.target.value })} value={form.industry} /></Field>
            <Field htmlFor="tpl-brand" label="Brand"><Input id="tpl-brand" onChange={(event) => setForm({ ...form, brand: event.target.value })} value={form.brand} /></Field>
          </div>
          <Field htmlFor="tpl-tags" label="Tags (comma-separated)" hint="Stored as an array."><Input id="tpl-tags" onChange={(event) => setForm({ ...form, tags: event.target.value })} value={form.tags} /></Field>
          <Field htmlFor="tpl-options" label="Options (JSON)" hint="Generation parameters: prompt, aspectRatio, style, lighting, colorAndTone, composition, negativePrompt."><textarea id="tpl-options" className="min-h-[6rem] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] p-[var(--tri-input-padding-inline)] font-mono text-[var(--tri-text-primary)]" onChange={(event) => setForm({ ...form, options: event.target.value })} value={form.options} /></Field>
          <div className="grid gap-[var(--tri-space-3)] sm:grid-cols-2">
            <Field htmlFor="tpl-thumb" label="Thumbnail URL"><Input id="tpl-thumb" onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })} value={form.thumbnailUrl} /></Field>
            <Field htmlFor="tpl-gcs" label="GCS URI"><Input id="tpl-gcs" onChange={(event) => setForm({ ...form, gcsUri: event.target.value })} value={form.gcsUri} /></Field>
          </div>
          <div className="flex justify-end gap-[var(--tri-space-3)]">
            <Button onClick={() => setFormOpen(false)} type="button" variant="ghost">Cancel</Button>
            <Button disabled={saving} type="submit">{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog confirmLabel="Delete" message={deleting ? `Delete template "${deleting.name}"? This cannot be undone.` : ""} onClose={() => setDeleting(undefined)} onConfirm={confirmDelete} open={!!deleting} title="Delete template" tone="danger" />
    </section>
  );
}

// Re-export pure helpers for targeted tests + downstream reuse.
export { parseOptionsJson, parseTags, templateToForm, formToUpdateBody, formToCreateBody, EMPTY_FORM };
export type { FormState, Template };
