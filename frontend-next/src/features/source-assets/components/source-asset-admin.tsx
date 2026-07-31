/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, ConfirmDialog, Dialog, Field, Input } from "@/src/components/ui";
import {
  Paginator,
  useDebouncedCallback,
  type SortDirection,
} from "@/src/features/admin/components/admin-controls";
import { useWorkspace } from "@/src/lib/workspace";

import { SourceAssetList } from "./source-asset-list";
import { useSourceAssets } from "../hooks/use-source-assets";
import type { SourceAsset } from "../types";
import {
  ASSET_SCOPE_OPTIONS,
  ASSET_TYPE_OPTIONS,
  AssetScope,
  AssetType,
  EMPTY_SOURCE_ASSET_FILTERS,
  buildSourceAssetQuery,
  buildUploadFields,
  nextSortDirection,
  type SourceAssetFilters,
  type SourceAssetSortKey,
} from "../source-asset-filters";

type Page = { data: SourceAsset[]; count: number };

function csrfToken() {
  return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

/**
 * Platform-wide admin browse for source assets. Mirrors Angular
 * `source-assets-management.component`:
 *   - Scope + Type filters, debounced Search, Clear + Search actions
 *   - Thumbnail / Filename / Type / Created / Actions table with sort + paginator
 *   - Create-Asset dialog uploads via the existing BFF (preserved) using the
 *     active workspace (backend `/upload` requires `workspaceId`)
 *   - Delete confirmed via `ConfirmDialog` (replaces `window.confirm`)
 *
 * Edit action intentionally omitted — backend has no update endpoint
 * (`source_asset_controller.py` exposes upload/search/get/delete only).
 */
export function SourceAssetAdmin() {
  const { activeWorkspace } = useWorkspace();
  const { upload } = useSourceAssets();

  const [items, setItems] = useState<SourceAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<SourceAssetFilters>(EMPTY_SOURCE_ASSET_FILTERS);
  const [sortKey, setSortKey] = useState<SourceAssetSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [deleting, setDeleting] = useState<SourceAsset | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Upload dialog form state.
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadScope, setUploadScope] = useState<string>(AssetScope.SYSTEM);
  const [uploadAssetType, setUploadAssetType] = useState<string>(AssetType.GENERIC_IMAGE);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const url = `/api/source-assets${buildSourceAssetQuery(filters, page, pageSize)}`;
    void fetch(url)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("source assets load failed"))))
      .then((data: Page) => {
        setItems(data.data ?? []);
        setTotal(data.count ?? 0);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Failed to load source assets");
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [filters, page, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load());
    return () => window.clearTimeout(timer);
  }, [load]);

  const apply = (patch: Partial<SourceAssetFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  };
  const applySearch = useDebouncedCallback((value: string) => apply({ search: value }), 400);

  const onSort = (key: SourceAssetSortKey) => {
    const dir = nextSortDirection(key === sortKey ? sortDir : null);
    setSortKey(dir ? key : null);
    setSortDir(dir);
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return items;
    const get: Record<SourceAssetSortKey, (asset: SourceAsset) => string> = {
      name: (asset) => asset.originalFilename ?? asset.name ?? "",
      type: (asset) => `${asset.type}`,
      created: (asset) => asset.createdAt ?? "",
    };
    const copy = [...items];
    copy.sort((a, b) => {
      const left = get[sortKey](a);
      const right = get[sortKey](b);
      return (left < right ? -1 : left > right ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
    });
    return copy;
  }, [items, sortKey, sortDir]);

  const onPage = (nextIndex: number, nextSize: number) => {
    setPage(nextIndex);
    setPageSize(nextSize);
  };

  const remove = async (asset: SourceAsset) => {
    const response = await fetch(`/api/source-assets/${encodeURIComponent(asset.id)}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken() },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to delete source asset");
    }
    void load();
  };

  const openUpload = () => {
    setUploadFile(null);
    setUploadScope(AssetScope.SYSTEM);
    setUploadAssetType(AssetType.GENERIC_IMAGE);
    setUploadError(null);
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!uploadFile) {
      setUploadError("Please choose a file.");
      return;
    }
    if (!activeWorkspace) {
      setUploadError("Select a workspace before uploading.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await upload(uploadFile, Number(activeWorkspace.id), buildUploadFields(uploadScope, uploadAssetType));
      setUploadOpen(false);
      void load();
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Failed to upload source asset");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-[var(--tri-space-4)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--tri-space-3)]">
        <h2 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">All source assets</h2>
        <Button onClick={openUpload} type="button" variant="primary">
          Create asset
        </Button>
      </div>

      {/* Filters — order/labels match Angular source-assets-management */}
      <div className="grid grid-cols-1 gap-[var(--tri-space-3)] md:grid-cols-4">
        <Field htmlFor="sa-search" label="Search">
          <Input
            autoComplete="off"
            id="sa-search"
            onChange={(event) => applySearch(event.target.value)}
            placeholder="Filename..."
            value={filters.search}
          />
        </Field>
        <Field htmlFor="sa-scope" label="Filter by scope">
          <select
            className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]"
            id="sa-scope"
            onChange={(event) => apply({ scope: event.target.value })}
            value={filters.scope}
          >
            <option value="">All scopes</option>
            {ASSET_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field htmlFor="sa-type" label="Filter by type">
          <select
            className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]"
            id="sa-type"
            onChange={(event) => apply({ assetType: event.target.value })}
            value={filters.assetType}
          >
            <option value="">All types</option>
            {ASSET_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end justify-end gap-[var(--tri-space-2)]">
          <Button
            onClick={() => {
              setFilters(EMPTY_SOURCE_ASSET_FILTERS);
              setPage(0);
            }}
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
          <Button onClick={() => void load()} type="button" variant="secondary">
            Search
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[var(--tri-state-error)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)]">
        {loading && items.length === 0 ? (
          <div aria-busy="true" aria-label="Loading source assets" className="grid gap-[var(--tri-space-3)] p-[var(--tri-space-6)]">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="h-[var(--tri-control-height-md)] animate-pulse rounded-[var(--tri-input-radius)] bg-[var(--tri-bg-surface-alt)]" key={index} />
            ))}
          </div>
        ) : (
          <SourceAssetList
            items={sorted}
            onDelete={(asset) => setDeleting(asset)}
            onSort={onSort}
            sortDir={sortDir}
            sortKey={sortKey}
          />
        )}
        <Paginator
          ariaLabel="Source assets pagination"
          onPage={onPage}
          pageIndex={page}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 100]}
          total={total}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Delete"
        message={deleting ? `Delete asset "${deleting.originalFilename ?? deleting.name}"? This cannot be undone.` : ""}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void remove(deleting);
        }}
        open={Boolean(deleting)}
        title="Confirm deletion"
        tone="danger"
      />

      <Dialog
        description="Upload a new source asset. Scope and type are admin-only fields forwarded to the backend."
        onClose={() => setUploadOpen(false)}
        open={uploadOpen}
        size="md"
        title="Create source asset"
      >
        <div className="mt-[var(--tri-space-4)] space-y-[var(--tri-space-3)]">
          <Field htmlFor="sa-file" label="File">
            <input
              className="block w-full text-sm text-[var(--tri-text-secondary)] file:mr-[var(--tri-space-3)] file:rounded-[var(--tri-input-radius)] file:border-0 file:bg-[var(--tri-button-primary-bg)] file:px-[var(--tri-space-3)] file:py-[var(--tri-space-2)] file:text-[var(--tri-button-primary-fg)]"
              id="sa-file"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </Field>
          <Field htmlFor="sa-upload-scope" label="Scope">
            <select
              className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]"
              id="sa-upload-scope"
              onChange={(event) => setUploadScope(event.target.value)}
              value={uploadScope}
            >
              {ASSET_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field htmlFor="sa-upload-type" label="Asset type">
            <select
              className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-space-2)] text-[var(--tri-text-primary)]"
              id="sa-upload-type"
              onChange={(event) => setUploadAssetType(event.target.value)}
              value={uploadAssetType}
            >
              {ASSET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          {uploadError ? (
            <p className="text-sm text-[var(--tri-state-error)]" role="alert">
              {uploadError}
            </p>
          ) : null}
          <div className="flex justify-end gap-[var(--tri-space-3)]">
            <Button onClick={() => setUploadOpen(false)} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={uploading} onClick={() => void submitUpload()} type="button" variant="primary">
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
