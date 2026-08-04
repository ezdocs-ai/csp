// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui";
import { ColorPicker, Paginator, pageOffset } from "./admin-controls";
import { useWorkspace } from "@/src/lib/workspace";
import { tagBulkAssignPayload, tagCreatePayload, tagSearchPayload } from "../tags-payload";

interface Tag {
  id: number;
  name: string;
  workspace_id: number;
  color?: string;
  media_count?: number;
}

const DEFAULT_COLOR = "#E8EAED";

function csrfToken(): string {
  return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

export function TagManager() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace ? Number(activeWorkspace.id) : 0;

  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [name, setName] = useState("");
  const [mediaIds, setMediaIds] = useState("");
  const [tagNames, setTagNames] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);

  const load = useCallback(() => {
    if (!workspaceId) return;
    void fetch("/api/admin/tags", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
      body: JSON.stringify({ action: "search", data: tagSearchPayload({ workspaceId, limit: pageSize, offset: pageOffset(page, pageSize) }) }),
    })
      .then((response) => (response.ok ? response.json() : { data: [], count: 0 }))
      .then((data) => {
        setTags((data.data ?? data.items ?? []) as Tag[]);
        setTotal(data.count ?? 0);
      })
      .catch(() => {
        setTags([]);
        setTotal(0);
      });
  }, [page, pageSize, workspaceId]);
  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || DEFAULT_COLOR);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor(DEFAULT_COLOR);
  };
  const saveEdit = async (tag: Tag) => {
    if (!editName.trim()) return;
    await fetch(`/api/admin/tags/${tag.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ name: editName.trim(), color: editColor }) });
    setEditingId(null);
    void load();
  };
  const remove = async (tagId: number) => {
    await fetch(`/api/admin/tags/${tagId}`, { method: "DELETE", headers: { "x-csrf-token": csrfToken() } });
    void load();
  };

  const onPage = (nextIndex: number, nextSize: number) => {
    setPage(nextIndex);
    setPageSize(nextSize);
  };

  return (
    <section className="space-y-[var(--tri-space-4)]">
      <h1 className="font-[var(--tri-font-display)] text-[var(--tri-text-h2-size)]">Tags Management</h1>

      <form
        className="flex flex-wrap items-end gap-[var(--tri-space-3)]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!activeWorkspace) return;
          await fetch("/api/admin/tags", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify(tagCreatePayload({ workspaceId: Number(activeWorkspace.id), name })) });
          setName("");
          void load();
        }}
      >
        <Field htmlFor="tag-name" label="New tag name">
          <Input autoComplete="off" id="tag-name" onChange={(event) => setName(event.target.value)} placeholder="Enter tag name" required value={name} />
        </Field>
        <Button disabled={!activeWorkspace} type="submit" variant="primary">
          Create Tag
        </Button>
      </form>

      <details className="rounded-xl border border-[var(--tri-input-border)]">
        <summary className="min-h-[var(--tri-control-height-md)] cursor-pointer list-none px-[var(--tri-space-4)] py-[var(--tri-space-2)] text-[var(--tri-text-primary)]">
          Bulk assign tags
        </summary>
        <form
          className="flex flex-wrap items-end gap-[var(--tri-space-3)] border-t border-[var(--tri-input-border)] px-[var(--tri-space-4)] py-[var(--tri-space-3)]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!activeWorkspace) return;
            const itemIds = mediaIds.split(",").map(Number).filter((n) => Number.isFinite(n));
            const names = tagNames.split(",").map((t) => t.trim()).filter(Boolean);
            await fetch("/api/admin/tags", {
              method: "POST",
              headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
              body: JSON.stringify({ action: "bulk-assign", data: tagBulkAssignPayload({ workspaceId: Number(activeWorkspace.id), itemIds, tagNames: names }) }),
            });
            void load();
          }}
        >
          <Field htmlFor="tag-media-ids" label="Media IDs (comma-separated)">
            <Input autoComplete="off" id="tag-media-ids" onChange={(event) => setMediaIds(event.target.value)} placeholder="1,2,3" required value={mediaIds} />
          </Field>
          <Field htmlFor="tag-names" label="Tag names (comma-separated)">
            <Input autoComplete="off" id="tag-names" onChange={(event) => setTagNames(event.target.value)} placeholder="campaign,hero" required value={tagNames} />
          </Field>
          <Button disabled={!activeWorkspace} type="submit" variant="secondary">
            Assign tags
          </Button>
        </form>
      </details>

      <div className="overflow-hidden rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">ID</TableHead>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Color</TableHead>
              <TableHead className="text-right" scope="col">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState description="No tags found for this workspace." title="No tags" />
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => {
                const editing = editingId === tag.id;
                const displayColor = editing ? editColor : tag.color || DEFAULT_COLOR;
                return (
                  <TableRow key={tag.id}>
                    <TableCell>{tag.id}</TableCell>
                    <TableCell>
                      {editing ? (
                        <Input aria-label={`Edit name for tag ${tag.id}`} onChange={(event) => setEditName(event.target.value)} value={editName} />
                      ) : (
                        tag.name
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-[var(--tri-space-2)]">
                        {editing ? (
                          <ColorPicker label={`Color for tag ${tag.id}`} onChange={setEditColor} value={editColor} />
                        ) : (
                          <span aria-hidden="true" className="size-6 rounded border border-[var(--tri-input-border)]" style={{ backgroundColor: displayColor }} />
                        )}
                        <span className="text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{displayColor}</span>
                      </div>
                    </TableCell>
                    <TableCell actions>
                      <div className="flex justify-end gap-1">
                        {editing ? (
                          <>
                            <Button disabled={!editName.trim()} onClick={() => void saveEdit(tag)} type="button" variant="primary">
                              Save
                            </Button>
                            <Button onClick={() => cancelEdit()} type="button" variant="ghost">
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button onClick={() => startEdit(tag)} type="button" variant="ghost">
                              Edit
                            </Button>
                            <Button onClick={() => void remove(tag.id)} type="button" variant="danger">
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <Paginator ariaLabel="Tags pagination" onPage={onPage} pageIndex={page} pageSize={pageSize} pageSizeOptions={[5, 10, 20]} total={total} />
      </div>
    </section>
  );
}
