// Copyright 2025 Google LLC — Apache-2.0
"use client";

import { useMemo, useState } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui";
import { UserEditDialog } from "./user-edit-dialog";
import { Paginator, SortableHead, roleTone, useDebouncedCallback, type SortDirection } from "./admin-controls";
import { pageOffset, useAdminUsers } from "../hooks/use-admin-users";
import type { AdminUser, AdminUsersResponse } from "../types";

type SortKey = "name" | "email" | "roles" | "createdAt" | "updatedAt";
const VALUE: Record<SortKey, (user: AdminUser) => string> = {
  name: (user) => user.name ?? user.display_name ?? "",
  email: (user) => user.email,
  roles: (user) => (user.roles ?? []).join(","),
  createdAt: (user) => user.createdAt ?? user.created_at ?? "",
  updatedAt: (user) => user.updatedAt ?? user.updated_at ?? "",
};

// Signed remote avatar URLs cannot go through next/image without remote-pattern config.
function Avatar({ user }: { user: AdminUser }) {
  if (!user.picture) {
    return <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]">{(user.name ?? user.email).charAt(0).toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" className="size-10 rounded-full object-cover" height={40} src={user.picture} width={40} />;
}

export function UsersTable({ initial }: { initial: AdminUsersResponse }) {
  const { result, remove, restore, updateRoles, refresh } = useAdminUsers(initial);
  const users = useMemo(() => result.items ?? result.data ?? [], [result]);
  const total = result.total ?? users.length;
  const [email, setEmail] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [editing, setEditing] = useState<AdminUser>();
  const [deleting, setDeleting] = useState<AdminUser>();
  const debouncedSearch = useDebouncedCallback((value: string) => { setPageIndex(0); void refresh({ email: value, includeDeleted, limit: pageSize, offset: 0 }); });
  const onSort = (id: string) => {
    const key = id as SortKey;
    const nextDir: SortDirection = key === sortKey ? (sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc") : "asc";
    setSortKey(nextDir ? key : null);
    setSortDir(nextDir);
  };
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return users;
    const get = VALUE[sortKey];
    const copy = [...users];
    copy.sort((a, b) => { const left = get(a); const right = get(b); return (left < right ? -1 : left > right ? 1 : 0) * (sortDir === "asc" ? 1 : -1); });
    return copy;
  }, [users, sortKey, sortDir]);
  const onPage = (nextIndex: number, nextSize: number) => { setPageIndex(nextIndex); setPageSize(nextSize); void refresh({ email, includeDeleted, limit: nextSize, offset: pageOffset(nextIndex, nextSize) }); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field htmlFor="users-email-filter" label="Filter by email">
          <Input autoComplete="off" id="users-email-filter" onChange={(event) => { setEmail(event.target.value); debouncedSearch(event.target.value); }} placeholder="Search by email" value={email} />
        </Field>
        <label className="inline-flex min-h-[var(--tri-control-height-md)] items-center gap-[var(--tri-space-2)] text-[var(--tri-text-small-size)]">
          <input checked={includeDeleted} onChange={(event) => { setIncludeDeleted(event.target.checked); setPageIndex(0); void refresh({ email, includeDeleted: event.target.checked, limit: pageSize, offset: 0 }); }} type="checkbox" /> Include deleted
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table aria-label="Users">
          <TableHeader>
            <TableRow>
              <TableHead aria-sort="none" scope="col">Picture</TableHead>
              <SortableHead active={sortKey === "name"} direction={sortKey === "name" ? sortDir : null} id="name" onSort={onSort}>Username</SortableHead>
              <SortableHead active={sortKey === "email"} direction={sortKey === "email" ? sortDir : null} id="email" onSort={onSort}>Email</SortableHead>
              <SortableHead active={sortKey === "roles"} direction={sortKey === "roles" ? sortDir : null} id="roles" onSort={onSort}>Roles</SortableHead>
              <SortableHead active={sortKey === "createdAt"} direction={sortKey === "createdAt" ? sortDir : null} id="createdAt" onSort={onSort}>Created</SortableHead>
              <SortableHead active={sortKey === "updatedAt"} direction={sortKey === "updatedAt" ? sortDir : null} id="updatedAt" onSort={onSort}>Updated</SortableHead>
              <TableHead className="text-right" scope="col"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={7}><EmptyState description="Try adjusting the email filter or include deleted users." title="No users found" /></TableCell></TableRow>
            ) : sorted.map((user) => {
              const deleted = user.is_deleted ?? Boolean(user.deleted_at);
              return (
                <TableRow className={deleted ? "opacity-50" : ""} key={user.id}>
                  <TableCell><Avatar user={user} /></TableCell>
                  <TableCell>{user.name ?? user.display_name ?? "—"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{(user.roles ?? (user.role ? [user.role] : [])).map((role) => <Badge key={role} tone={roleTone(role)}>{role}</Badge>)}</div></TableCell>
                  <TableCell>{(user.createdAt ?? user.created_at) ? new Date(user.createdAt ?? user.created_at!).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{(user.updatedAt ?? user.updated_at) ? new Date(user.updatedAt ?? user.updated_at!).toLocaleDateString() : "—"}</TableCell>
                  <TableCell actions>
                    <div className="flex justify-end gap-1">
                      <Button disabled={deleted} onClick={() => setEditing(user)} type="button" variant="ghost">Edit</Button>
                      {deleted
                        ? <Button onClick={() => void restore(user.id)} type="button" variant="ghost">Restore</Button>
                        : <Button onClick={() => setDeleting(user)} type="button" variant="danger">Delete</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Paginator ariaLabel="Select page of users" onPage={onPage} pageIndex={pageIndex} pageSize={pageSize} pageSizeOptions={[10, 25, 100]} total={total} />
      </div>

      {editing ? <UserEditDialog onClose={() => setEditing(undefined)} onSaved={(roles) => void updateRoles(editing.id, roles)} user={editing} /> : null}
      <ConfirmDialog
        confirmLabel="Delete"
        message={deleting ? `Delete user ${deleting.email}? This disables their access.` : ""}
        onClose={() => setDeleting(undefined)}
        onConfirm={async () => { if (deleting) { await remove(deleting.id); void refresh({ email, includeDeleted, limit: pageSize, offset: pageOffset(pageIndex, pageSize) }); } }}
        open={Boolean(deleting)}
        tone="danger"
        title="Confirm deletion"
      />
    </div>
  );
}
