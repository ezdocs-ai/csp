/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import type { ReactNode } from "react";

import { Badge, Button, EmptyState } from "@/src/components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { SortableHead, type SortDirection } from "@/src/features/admin/components/admin-controls";

import type { SourceAsset } from "../types";
import type { SourceAssetSortKey } from "../source-asset-filters";

export interface SourceAssetListProps {
  items: SourceAsset[];
  sortKey: SourceAssetSortKey | null;
  sortDir: SortDirection;
  onSort: (key: SourceAssetSortKey) => void;
  onDelete: (asset: SourceAsset) => void;
  /** Render the actions cell — kept pluggable so the table stays presentational. */
  actions?: (asset: SourceAsset) => ReactNode;
}

function Thumbnail({ asset }: { asset: SourceAsset }) {
  const src = asset.thumbnailUrl ?? asset.url;
  if (!src) {
    return (
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-md border border-[var(--tri-input-border)] bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]">
        ▤
      </span>
    );
  }
  // Signed GCS URLs must bypass Next image optimization (would invalidate signature).
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="size-10 rounded-md object-cover" height={40} src={src} width={40} />
  );
}

function typeTone(asset: SourceAsset): "info" | "warning" | "success" | "neutral" {
  if (asset.type === "video") return "warning";
  if (asset.type === "audio") return "success";
  if (asset.type === "image") return "info";
  return "neutral";
}

/**
 * Presentational admin asset table. Columns mirror Angular
 * `source-assets-management.component.html`:
 * thumbnail / originalFilename / assetType chip / createdAt / actions.
 * Edit action intentionally omitted — backend exposes no update endpoint
 * (see `source_asset_controller.py`; `[id]/route.ts` PATCH returns 501).
 */
export function SourceAssetList({ items, sortKey, sortDir, onSort, onDelete, actions }: SourceAssetListProps) {
  if (!items.length) {
    return <EmptyState description="Try adjusting the filters above or upload a new asset." title="No source assets" />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Thumbnail</TableHead>
          <SortableHead active={sortKey === "name"} direction={sortKey === "name" ? sortDir : null} id="name" onSort={(id) => onSort(id as SourceAssetSortKey)}>
            Filename
          </SortableHead>
          <SortableHead active={sortKey === "type"} direction={sortKey === "type" ? sortDir : null} id="type" onSort={(id) => onSort(id as SourceAssetSortKey)}>
            Type
          </SortableHead>
          <SortableHead active={sortKey === "created"} direction={sortKey === "created" ? sortDir : null} id="created" onSort={(id) => onSort(id as SourceAssetSortKey)}>
            Created
          </SortableHead>
          <TableHead className="text-right" scope="col">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell>
              <Thumbnail asset={asset} />
            </TableCell>
            <TableCell>{asset.originalFilename ?? asset.name}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <Badge tone={typeTone(asset)}>{asset.type}</Badge>
                {asset.assetType ? <Badge tone="neutral">{asset.assetType}</Badge> : null}
              </div>
            </TableCell>
            <TableCell>{asset.createdAt ? new Date(asset.createdAt).toLocaleString() : "—"}</TableCell>
            <TableCell actions>
              {actions ? (
                actions(asset)
              ) : (
                <Button onClick={() => onDelete(asset)} type="button" variant="danger">
                  Delete
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
