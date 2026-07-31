// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BadgeTone } from "@/src/components/ui";
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui";
import { MultiSelect, Paginator, SortableHead, pageOffset, toQuery, useDebouncedCallback, type QueryParams, type SortDirection } from "./admin-controls";

/** Reads the double-submit CSRF token from the non-httpOnly cookie (mirrors tag-manager.tsx). */
function csrfToken(): string {
  return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

/** Mirrors the backend unified gallery item (camel + snake fallbacks). */
export interface MediaGalleryItem {
  id: number;
  itemType?: string;
  item_type?: string;
  workspaceId?: number;
  workspace_id?: number;
  workspaceName?: string;
  userEmail?: string;
  user_email?: string;
  userPicture?: string;
  user_picture?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  deletedAt?: string;
  deleted_at?: string;
  model?: string;
  prompt?: string;
  presignedThumbnailUrls?: string[];
  presignedUrls?: string[];
  metadata?: Record<string, unknown> & { mimeType?: string; assetType?: string; workspaceName?: string; userEmail?: string; model?: string; userPicture?: string };
}

export interface MediaFilters {
  search: string;
  email: string;
  status: string;
  type: string;
  model: string;
  tags: string[];
  start: string;
  end: string;
}

export const MEDIA_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "stopped", label: "Stopped" },
];

export const MEDIA_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "media_item", label: "AI Generated" },
  { value: "source_asset", label: "User Upload" },
];

// Mirrors Angular MODEL_CONFIGS (value / display name) for the Model filter.
export const MODEL_OPTIONS = [
  { value: "gemini-3.1-flash-image", label: "Nano Banana 2" },
  { value: "gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite" },
  { value: "gemini-3-pro-image", label: "Nano Banana Pro" },
  { value: "gemini-2.5-flash-image", label: "Nano Banana" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { value: "gemini-omni-flash-preview", label: "Gemini Omni Flash" },
  { value: "veo-3.1-generate-001", label: "Veo 3.1" },
  { value: "veo-3.1-lite-generate-001", label: "Veo 3.1 Lite (Preview)" },
  { value: "veo-3.1-fast-generate-001", label: "Veo 3.1 Fast" },
  { value: "lyria-002", label: "Lyria" },
  { value: "gemini-2.5-flash-tts", label: "Gemini TTS" },
  { value: "chirp_3", label: "Chirp" },
];

/** Pure query serializer for the media gallery filter set. Unit-tested. */
export function buildMediaQuery(input: MediaFilters & { offset: number; limit: number }): string {
  const params: QueryParams = {
    search: input.search.trim() || null,
    user_email: input.email.trim() || null,
    status: input.status || null,
    item_type: input.type || null,
    model: input.model || null,
    tags: input.tags.length ? input.tags.join(",") : null,
    start_date: input.start || null,
    end_date: input.end || null,
    limit: input.limit,
    offset: input.offset,
  };
  return toQuery(params);
}

type SortKey = "workspace" | "user" | "status" | "created";
function workspaceLabel(item: MediaGalleryItem): string {
  const id = item.workspaceId ?? item.workspace_id;
  return item.workspaceName ?? (id ? `ID ${id}` : "");
}
const SORT_VALUE: Record<SortKey, (item: MediaGalleryItem) => string> = {
  workspace: workspaceLabel,
  user: (item) => item.userEmail ?? item.user_email ?? item.metadata?.userEmail ?? "",
  status: (item) => item.status ?? "",
  created: (item) => item.createdAt ?? item.created_at ?? "",
};

export function statusTone(status?: string): BadgeTone {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
    case "succeeded":
      return "success";
    case "processing":
    case "running":
      return "warning";
    case "failed":
    case "errored":
      return "danger";
    default:
      return "neutral";
  }
}

function Preview({ item }: { item: MediaGalleryItem }) {
  const mime = item.metadata?.mimeType;
  const isAudio = mime?.startsWith("audio") || item.metadata?.assetType === "audio";
  if (isAudio) {
    return <span aria-hidden="true" className="grid size-12 place-items-center rounded border border-[var(--tri-input-border)] bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]">♪</span>;
  }
  const src = item.presignedThumbnailUrls?.[0] ?? item.presignedUrls?.[0];
  if (!src) {
    return <span aria-hidden="true" className="grid size-12 place-items-center rounded bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]">{(item.itemType ?? item.item_type) === "source_asset" ? "▤" : "▣"}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" className="size-12 rounded object-cover" height={48} src={src} width={48} />;
}

function UserCell({ item }: { item: MediaGalleryItem }) {
  const email = item.userEmail ?? item.user_email ?? item.metadata?.userEmail ?? "N/A";
  const picture = item.userPicture ?? item.user_picture ?? item.metadata?.userPicture;
  const initial = email.charAt(0).toUpperCase();
  if (!picture) {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]" title={email}>
        {initial}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="size-8 rounded-full object-cover" height={32} src={picture} title={email} width={32} />
  );
}

export function MediaGalleryAdmin() {
  const [items, setItems] = useState<MediaGalleryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<MediaFilters>({ search: "", email: "", status: "", type: "", model: "", tags: [], start: "", end: "" });
  const [tagOptions, setTagOptions] = useState<{ value: string; label: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [deleting, setDeleting] = useState<MediaGalleryItem | null>(null);
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);

  const load = useCallback(() => {
    void fetch(`/api/admin/media-gallery${buildMediaQuery({ ...filters, offset: pageOffset(page, pageSize), limit: pageSize })}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("media gallery load failed"))))
      .then((data) => {
        const list = (data.items ?? data.data ?? []) as MediaGalleryItem[];
        setItems(list);
        setTotal(data.count ?? data.total ?? list.length);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      });
  }, [filters, page, pageSize]);
  useEffect(() => {
    void load();
  }, [load]);

  // Load tag options for the Tags multi-select filter (Angular loads workspace tags the same way).
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/tags")
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((data) => {
        if (!active) return;
        const list = (data.data ?? data.items ?? []) as { name?: string }[];
        setTagOptions(list.map((tag) => ({ value: tag.name ?? "", label: tag.name ?? "" })).filter((option) => option.value));
      })
      .catch(() => {
        /* tag filter is optional; leave options empty */
      });
    return () => {
      active = false;
    };
  }, []);

  const action = async (actionName: string, id?: number, itemType?: string, workspaceId?: number) => {
    await fetch("/api/admin/media-gallery", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ action: actionName, id, itemType, workspaceId }) });
    void load();
  };

  const apply = (patch: Partial<MediaFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  };
  const applyText = useDebouncedCallback((patch: Partial<MediaFilters>) => apply(patch), 400);

  const onSort = (id: string) => {
    const key = id as SortKey;
    const nextDir: SortDirection = key === sortKey ? (sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc") : "asc";
    setSortKey(nextDir ? key : null);
    setSortDir(nextDir);
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return items;
    const get = SORT_VALUE[sortKey];
    const copy = [...items];
    copy.sort((a, b) => {
      const left = get(a);
      const right = get(b);
      return (left < right ? -1 : left > right ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
    });
    return copy;
  }, [items, sortKey, sortDir]);

  const onPage = (nextIndex: number, nextSize: number) => {
    setPage(nextIndex);
    setPageSize(nextSize);
  };

  return (
    <section className="space-y-[var(--tri-space-4)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--tri-space-3)]">
        <h1 className="font-[var(--tri-font-display)] text-[var(--tri-text-h2-size)]">Media Gallery Management</h1>
        <Button onClick={() => setConfirmingCleanup(true)} title="Clear jobs in processing for more than 1 hour" type="button" variant="danger">
          Clear Stuck Jobs
        </Button>
      </div>

      {/* Filters — order/labels match Angular admin media-gallery-management */}
      <div className="grid grid-cols-1 gap-[var(--tri-space-3)] md:grid-cols-6">
        <Field htmlFor="mg-search" label="Search">
          <Input autoComplete="off" id="mg-search" onChange={(event) => applyText({ search: event.target.value })} placeholder="Search terms..." value={filters.search} />
        </Field>
        <Field htmlFor="mg-email" label="User Email">
          <Input autoComplete="off" id="mg-email" onChange={(event) => applyText({ email: event.target.value })} placeholder="User Email" value={filters.email} />
        </Field>
        <Field htmlFor="mg-status" label="Status">
          <select
            className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]"
            id="mg-status"
            onChange={(event) => apply({ status: event.target.value })}
            value={filters.status}
          >
            {MEDIA_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field htmlFor="mg-type" label="Type">
          <select
            className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]"
            id="mg-type"
            onChange={(event) => apply({ type: event.target.value })}
            value={filters.type}
          >
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field htmlFor="mg-model" label="Model">
          <select
            className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]"
            id="mg-model"
            onChange={(event) => apply({ model: event.target.value })}
            value={filters.model}
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <MultiSelect label="Tags" onChange={(next) => apply({ tags: next })} options={tagOptions} value={filters.tags} />
        <Field htmlFor="mg-start" label="Start date">
          <Input id="mg-start" onChange={(event) => apply({ start: event.target.value })} type="date" value={filters.start} />
        </Field>
        <Field htmlFor="mg-end" label="End date">
          <Input id="mg-end" onChange={(event) => apply({ end: event.target.value })} type="date" value={filters.end} />
        </Field>
        {(filters.start || filters.end) && (
          <div className="flex items-end">
            <Button onClick={() => apply({ start: "", end: "" })} type="button" variant="ghost">
              Clear dates
            </Button>
          </div>
        )}
      </div>
      {/* ponytail: include-deleted toggle deferred — backend supports include_deleted (gallery_search_dto.py),
          but this view has no toggle control; the GET route hardcodes include_deleted=true so soft-deleted items
          (and their Restore action) stay visible. Add a checkbox + forward the param only when a control exists. */}

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Preview</TableHead>
              <SortableHead active={sortKey === "workspace"} direction={sortKey === "workspace" ? sortDir : null} id="workspace" onSort={onSort}>
                Workspace
              </SortableHead>
              <SortableHead active={sortKey === "user"} direction={sortKey === "user" ? sortDir : null} id="user" onSort={onSort}>
                User
              </SortableHead>
              <TableHead scope="col">Type / Model</TableHead>
              <SortableHead active={sortKey === "status"} direction={sortKey === "status" ? sortDir : null} id="status" onSort={onSort}>
                Status
              </SortableHead>
              <SortableHead active={sortKey === "created"} direction={sortKey === "created" ? sortDir : null} id="created" onSort={onSort}>
                Created
              </SortableHead>
              <TableHead className="text-right" scope="col">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState description="Try adjusting the filters above." title="No media items found" />
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((item) => {
                const itemType = item.itemType ?? item.item_type ?? "media_item";
                const workspace = item.workspaceName || item.metadata?.workspaceName || workspaceLabel(item) || "N/A";
                const created = item.createdAt ?? item.created_at;
                const deleted = Boolean(item.deletedAt ?? item.deleted_at);
                const model = item.model ?? item.metadata?.model;
                const detailHref = itemType === "source_asset" ? `/asset-detail/${item.id}` : `/gallery/${item.id}`;
                return (
                  <TableRow className={deleted ? "opacity-50" : ""} key={item.id}>
                    <TableCell>
                      <Preview item={item} />
                    </TableCell>
                    <TableCell>{workspace}</TableCell>
                    <TableCell>
                      <UserCell item={item} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {itemType === "media_item" ? <Badge tone="info">AI Generated</Badge> : <Badge tone="neutral">User Upload</Badge>}
                        {model ? <Badge tone="neutral">{model}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status ? <Badge tone={statusTone(item.status)}>{item.status}</Badge> : <span className="text-[var(--tri-text-tertiary)]">N/A</span>}
                    </TableCell>
                    <TableCell>{created ? new Date(created).toLocaleString() : "—"}</TableCell>
                    <TableCell actions>
                      <div className="flex justify-end gap-1">
                        <a
                          aria-label={`Open item ${item.id} in new tab`}
                          className="inline-flex min-h-[var(--tri-control-height-md)] items-center gap-[var(--tri-space-1)] text-[var(--tri-text-secondary)] hover:text-[var(--tri-text-primary)]"
                          href={detailHref}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open ↗
                        </a>
                        {deleted ? (
                          <Button onClick={() => void action("restore", item.id, itemType, item.workspaceId ?? item.workspace_id)} type="button" variant="ghost">
                            Restore
                          </Button>
                        ) : (
                          <Button onClick={() => setDeleting(item)} type="button" variant="danger">
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <Paginator ariaLabel="Media gallery pagination" onPage={onPage} pageIndex={page} pageSize={pageSize} pageSizeOptions={[5, 10, 25, 50]} total={total} />
      </div>

      <ConfirmDialog
        confirmLabel="Clear stuck jobs"
        message="Clear stuck jobs older than 1 hour? This will mark them as stopped."
        onClose={() => setConfirmingCleanup(false)}
        onConfirm={() => void action("cleanup")}
        open={confirmingCleanup}
        title="Confirm cleanup"
        tone="danger"
      />
      <ConfirmDialog
        confirmLabel="Delete"
        message={deleting ? `Delete item ${deleting.id}?` : ""}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void action("delete", deleting.id, deleting.itemType ?? deleting.item_type, deleting.workspaceId ?? deleting.workspace_id);
        }}
        open={Boolean(deleting)}
        title="Confirm deletion"
        tone="danger"
      />
    </section>
  );
}
